// Soft-reservation helpers for inventory during the manual payment verification cycle.
//
// Strategy: at order placement, bump products.reserved_stock and record a row in
// stock_reservations(state='held'). On admin approval, consume (subtract from
// stock_quantity AND reserved_stock). On reject / expiry, release (subtract from
// reserved_stock only — stock is returned to the pool).
//
// Concurrency safety: every state transition takes row locks via SELECT ... FOR
// UPDATE, sorted by product_id, so two parallel checkouts cannot both see the
// same `available` slack and oversell.

const { db } = require("../config/db");

const RESERVATION_TTL_MINUTES = 60;

// ---------------------------------------------------------------------------
// Connection-aware variants
//
// The standalone helpers below (`reserveStockForOrder`, `consumeReservationsForOrder`,
// `releaseReservationsForOrder`) open their own pool connection + transaction.
// That's correct for standalone use but breaks when called from a caller that
// is already inside a `connection.beginTransaction()` — you'd deadlock waiting
// for a row your own outer transaction is locking.
//
// These `*OnConnection` variants take a caller-owned connection and assume
// the caller owns the transaction lifecycle (begin/commit/rollback). Use these
// from inside an existing route transaction; use the standalone wrappers from
// scripts / one-off operations.
// ---------------------------------------------------------------------------

// Aggregate duplicate product_id entries so multi-line/variant orders cannot
// pass per-line checks while exceeding available stock in total.
function aggregateReservationItems(items) {
  const qtyByProduct = new Map();
  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error(`Invalid reservation item for product ${item.product_id}`);
      err.code = "INVALID_RESERVATION_ITEM";
      throw err;
    }
    qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + quantity);
  }
  return [...qtyByProduct.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([product_id, quantity]) => ({ product_id, quantity }));
}

async function reserveStockOnConnection(conn, orderId, items, ttlMinutes = RESERVATION_TTL_MINUTES) {
  if (!Array.isArray(items) || items.length === 0) return;

  const sorted = aggregateReservationItems(items);
  const ids = sorted.map((i) => i.product_id);
  const byId = await lockProductsForUpdate(conn, ids);

  for (const item of sorted) {
    const row = byId.get(item.product_id);
    if (!row) {
      const err = new Error(`Product ${item.product_id} not found`);
      err.code = "PRODUCT_NOT_FOUND";
      err.productId = item.product_id;
      throw err;
    }
    const available = Number(row.stock_quantity) - Number(row.reserved_stock);
    if (available < item.quantity) {
      const err = new Error(`Insufficient stock for product ${item.product_id}`);
      err.code = "INSUFFICIENT_STOCK";
      err.productId = item.product_id;
      err.available = available;
      err.requested = item.quantity;
      throw err;
    }
  }

  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  for (const item of sorted) {
    await conn.query(
      `UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ?`,
      [item.quantity, item.product_id],
    );
    await conn.query(
      `INSERT INTO stock_reservations (order_id, product_id, quantity, state, expires_at)
       VALUES (?, ?, ?, 'held', ?)`,
      [orderId, item.product_id, item.quantity, expiresAt],
    );
  }
}

async function consumeReservationsOnConnection(conn, orderId, createdByUserId = null) {
  const [resvs] = await conn.query(
    `SELECT product_id, quantity FROM stock_reservations
      WHERE order_id = ? AND state = 'held'
      ORDER BY product_id FOR UPDATE`,
    [orderId],
  );
  if (resvs.length === 0) return 0;

  for (const r of resvs) {
    const [[product]] = await conn.query(
      'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
      [r.product_id],
    );
    if (!product) continue;
    const previousStock = Number(product.stock_quantity) || 0;
    const newStock = previousStock - Number(r.quantity);
    await conn.query(
      `UPDATE products
          SET stock_quantity = GREATEST(0, stock_quantity - ?),
              reserved_stock = GREATEST(0, reserved_stock - ?)
        WHERE id = ?`,
      [r.quantity, r.quantity, r.product_id],
    );
    await conn.query(
      `INSERT INTO inventory_movements
         (product_id, order_id, movement_type, quantity_change, previous_stock, new_stock, note, created_by_user_id)
       VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
      [
        r.product_id,
        orderId,
        -Math.abs(Number(r.quantity)),
        previousStock,
        newStock,
        `Stock consumed after payment approval for order #${orderId}`,
        createdByUserId,
      ],
    );
  }
  await conn.query(
    `UPDATE stock_reservations SET state='consumed' WHERE order_id=? AND state='held'`,
    [orderId],
  );
  return resvs.length;
}

async function releaseReservationsOnConnection(conn, orderId) {
  const [resvs] = await conn.query(
    `SELECT product_id, quantity FROM stock_reservations
      WHERE order_id = ? AND state = 'held'
      ORDER BY product_id FOR UPDATE`,
    [orderId],
  );
  if (resvs.length === 0) return 0;

  for (const r of resvs) {
    await conn.query(
      `UPDATE products SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE id = ?`,
      [r.quantity, r.product_id],
    );
  }
  await conn.query(
    `UPDATE stock_reservations SET state='released' WHERE order_id=? AND state='held'`,
    [orderId],
  );
  return resvs.length;
}

// Lock candidate product rows in a deterministic order to prevent deadlocks
// when overlapping multi-line orders touch the same SKUs.
async function lockProductsForUpdate(conn, productIds) {
  const sorted = [...new Set(productIds)].sort((a, b) => a - b);
  if (sorted.length === 0) return new Map();
  const [rows] = await conn.query(
    `SELECT id, stock_quantity, reserved_stock
       FROM products
      WHERE id IN (?)
      FOR UPDATE`,
    [sorted],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

// Reserve stock for an order. Items: [{ product_id, quantity }].
// Throws { code: 'INSUFFICIENT_STOCK', productId } if any line cannot be fulfilled.
// All-or-nothing: a single failure rolls the entire reservation back.
async function reserveStockForOrder(orderId, items) {
  if (!Array.isArray(items) || items.length === 0) return;

  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    await reserveStockOnConnection(conn, orderId, items);
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Consume reservations (admin approved): permanently deduct from stock_quantity
// and clear from reserved_stock. Safe to call once per order.
async function consumeReservationsForOrder(orderId, createdByUserId = null) {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    const [resvs] = await conn.query(
      `SELECT product_id, quantity FROM stock_reservations
        WHERE order_id = ? AND state = 'held'
        ORDER BY product_id FOR UPDATE`,
      [orderId],
    );

    for (const r of resvs) {
      const [[product]] = await conn.query(
        'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
        [r.product_id],
      );
      if (!product) continue;
      const previousStock = Number(product.stock_quantity) || 0;
      const newStock = previousStock - Number(r.quantity);
      await conn.query(
        `UPDATE products
            SET stock_quantity = GREATEST(0, stock_quantity - ?),
                reserved_stock = GREATEST(0, reserved_stock - ?)
          WHERE id = ?`,
        [r.quantity, r.quantity, r.product_id],
      );
      await conn.query(
        `INSERT INTO inventory_movements
           (product_id, order_id, movement_type, quantity_change, previous_stock, new_stock, note, created_by_user_id)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [
          r.product_id,
          orderId,
          -Math.abs(Number(r.quantity)),
          previousStock,
          newStock,
          `Stock consumed after payment approval for order #${orderId}`,
          createdByUserId,
        ],
      );
    }

    if (resvs.length > 0) {
      await conn.query(
        `UPDATE stock_reservations SET state='consumed' WHERE order_id=? AND state='held'`,
        [orderId],
      );
    }

    await conn.commit();
    return resvs.length;
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Release reservations (admin rejected, customer cancelled, or sweeper-triggered).
// Returns stock back to the available pool.
async function releaseReservationsForOrder(orderId) {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    const [resvs] = await conn.query(
      `SELECT product_id, quantity FROM stock_reservations
        WHERE order_id = ? AND state = 'held'
        ORDER BY product_id FOR UPDATE`,
      [orderId],
    );

    for (const r of resvs) {
      await conn.query(
        `UPDATE products SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE id = ?`,
        [r.quantity, r.product_id],
      );
    }

    if (resvs.length > 0) {
      await conn.query(
        `UPDATE stock_reservations SET state='released' WHERE order_id=? AND state='held'`,
        [orderId],
      );
    }

    await conn.commit();
    return resvs.length;
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Periodic sweeper: release any held reservations whose TTL has passed.
// Returns the number of expired reservations released.
async function sweepExpiredReservations() {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    // Release any held reservations whose 60-minute checkout window has expired.
    const [expired] = await conn.query(
      `SELECT id, product_id, quantity FROM stock_reservations
        WHERE state = 'held' AND expires_at < NOW()
        ORDER BY product_id FOR UPDATE`,
    );

    for (const r of expired) {
      await conn.query(
        `UPDATE products SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE id = ?`,
        [r.quantity, r.product_id],
      );
      await conn.query(
        `UPDATE stock_reservations SET state='released' WHERE id = ?`,
        [r.id],
      );
    }

    await conn.commit();
    return expired.length;
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Reconcile any drift between products.reserved_stock and the authoritative sum
// of active ('held') rows in stock_reservations. Drift can occur if orders or
// reservation rows are removed out-of-band (e.g. ON DELETE CASCADE on orders).
// Uses a non-locking pre-check so the steady state acquires zero row locks.
async function reconcileOrphanedReservedStock(dbClient = db) {
  const promisePool =
    typeof dbClient?.promise === "function" ? dbClient.promise() : dbClient;

  const [drifted] = await promisePool.query(
    `SELECT p.id, p.reserved_stock, COALESCE(sr.held_qty, 0) AS expected_reserved
       FROM products p
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS held_qty
           FROM stock_reservations
          WHERE state = 'held'
          GROUP BY product_id
       ) sr ON sr.product_id = p.id
      WHERE COALESCE(p.reserved_stock, 0) <> COALESCE(sr.held_qty, 0)
      ORDER BY p.id ASC`,
  );

  if (!Array.isArray(drifted) || drifted.length === 0) {
    return { reconciledCount: 0, releasedUnits: 0, products: [] };
  }

  const candidateIds = drifted
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  if (candidateIds.length === 0) {
    return { reconciledCount: 0, releasedUnits: 0, products: [] };
  }

  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();

    const [lockedProducts] = await conn.query(
      `SELECT id, reserved_stock
         FROM products
        WHERE id IN (?)
        ORDER BY id ASC
        FOR UPDATE`,
      [candidateIds],
    );

    const [heldRows] = await conn.query(
      `SELECT product_id, COALESCE(SUM(quantity), 0) AS held_qty
         FROM stock_reservations
        WHERE product_id IN (?) AND state = 'held'
        GROUP BY product_id`,
      [candidateIds],
    );

    const heldByProduct = new Map(
      (heldRows || []).map((row) => [
        Number(row.product_id),
        Math.max(0, Number(row.held_qty) || 0),
      ]),
    );

    const reconciledProducts = [];
    let releasedUnits = 0;

    for (const product of lockedProducts || []) {
      const productId = Number(product.id);
      const currentReserved = Number(product.reserved_stock) || 0;
      const expectedReserved = heldByProduct.get(productId) || 0;
      if (currentReserved === expectedReserved) {
        continue;
      }

      await conn.query(
        `UPDATE products SET reserved_stock = ? WHERE id = ?`,
        [expectedReserved, productId],
      );

      if (currentReserved > expectedReserved) {
        releasedUnits += currentReserved - expectedReserved;
      }
      reconciledProducts.push({
        id: productId,
        previousReserved: currentReserved,
        nextReserved: expectedReserved,
      });
    }

    await conn.commit();
    return {
      reconciledCount: reconciledProducts.length,
      releasedUnits,
      products: reconciledProducts,
    };
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

// Convenience: launch the sweeper on a fixed interval. Call once from index.js.
// Avoids overlapping runs if a sweep takes longer than the interval.
function startReservationSweeper({ intervalMs = 5 * 60_000, runOnStart = true } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const n = await sweepExpiredReservations();
      if (n > 0) console.log(`[stock-sweeper] released ${n} expired reservation(s)`);

      const reconciled = await reconcileOrphanedReservedStock();
      if (reconciled.reconciledCount > 0) {
        console.log(
          `[stock-sweeper] reconciled reserved_stock on ${reconciled.reconciledCount} product(s) (${reconciled.releasedUnits} orphaned unit(s) released)`,
        );
      }
    } catch (err) {
      console.warn('[stock-sweeper] sweep failed:', err?.message || err);
    } finally {
      running = false;
    }
  };
  if (runOnStart) {
    setImmediate(tick);
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}

module.exports = {
  RESERVATION_TTL_MINUTES,
  reserveStockForOrder,
  consumeReservationsForOrder,
  releaseReservationsForOrder,
  sweepExpiredReservations,
  reconcileOrphanedReservedStock,
  startReservationSweeper,
  // Connection-aware variants for callers that already hold a transaction
  reserveStockOnConnection,
  consumeReservationsOnConnection,
  releaseReservationsOnConnection,
};
