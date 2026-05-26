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

async function reserveStockOnConnection(conn, orderId, items, ttlMinutes = RESERVATION_TTL_MINUTES) {
  if (!Array.isArray(items) || items.length === 0) return;

  const sorted = [...items].sort(
    (a, b) => Number(a.product_id) - Number(b.product_id),
  );
  const ids = sorted.map((i) => Number(i.product_id));
  const byId = await lockProductsForUpdate(conn, ids);

  for (const item of sorted) {
    const row = byId.get(Number(item.product_id));
    if (!row) {
      const err = new Error(`Product ${item.product_id} not found`);
      err.code = "PRODUCT_NOT_FOUND";
      err.productId = item.product_id;
      throw err;
    }
    const available = Number(row.stock_quantity) - Number(row.reserved_stock);
    if (available < Number(item.quantity)) {
      const err = new Error(`Insufficient stock for product ${item.product_id}`);
      err.code = "INSUFFICIENT_STOCK";
      err.productId = item.product_id;
      err.available = available;
      err.requested = Number(item.quantity);
      throw err;
    }
  }

  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  for (const item of sorted) {
    await conn.query(
      `UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ?`,
      [Number(item.quantity), Number(item.product_id)],
    );
    await conn.query(
      `INSERT INTO stock_reservations (order_id, product_id, quantity, state, expires_at)
       VALUES (?, ?, ?, 'held', ?)`,
      [orderId, Number(item.product_id), Number(item.quantity), expiresAt],
    );
  }
}

async function consumeReservationsOnConnection(conn, orderId) {
  const [resvs] = await conn.query(
    `SELECT product_id, quantity FROM stock_reservations
      WHERE order_id = ? AND state = 'held'
      ORDER BY product_id FOR UPDATE`,
    [orderId],
  );
  if (resvs.length === 0) return 0;

  for (const r of resvs) {
    await conn.query(
      `UPDATE products
          SET stock_quantity = stock_quantity - ?,
              reserved_stock = reserved_stock - ?
        WHERE id = ?`,
      [r.quantity, r.quantity, r.product_id],
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
      `UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?`,
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

    const ids = items.map((i) => Number(i.product_id));
    const byId = await lockProductsForUpdate(conn, ids);

    for (const item of items) {
      const row = byId.get(Number(item.product_id));
      if (!row) {
        const err = new Error(`Product ${item.product_id} not found`);
        err.code = "PRODUCT_NOT_FOUND";
        err.productId = item.product_id;
        throw err;
      }
      const available = Number(row.stock_quantity) - Number(row.reserved_stock);
      if (available < Number(item.quantity)) {
        const err = new Error(`Insufficient stock for product ${item.product_id}`);
        err.code = "INSUFFICIENT_STOCK";
        err.productId = item.product_id;
        err.available = available;
        err.requested = Number(item.quantity);
        throw err;
      }
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000);

    // Apply in sorted order (matches the lock order) for clean ordering on replicas.
    const sorted = [...items].sort(
      (a, b) => Number(a.product_id) - Number(b.product_id),
    );
    for (const item of sorted) {
      await conn.query(
        `UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ?`,
        [Number(item.quantity), Number(item.product_id)],
      );
      await conn.query(
        `INSERT INTO stock_reservations (order_id, product_id, quantity, state, expires_at)
         VALUES (?, ?, ?, 'held', ?)`,
        [orderId, Number(item.product_id), Number(item.quantity), expiresAt],
      );
    }

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
async function consumeReservationsForOrder(orderId) {
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
        `UPDATE products
            SET stock_quantity = stock_quantity - ?,
                reserved_stock = reserved_stock - ?
          WHERE id = ?`,
        [r.quantity, r.quantity, r.product_id],
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
        `UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?`,
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

    // Skip reservations whose order has a pending stage-1 (advance_shipping)
    // verification: COD orders often sit waiting for admin approval longer
    // than the 60-minute TTL. If we released their stock here, the subsequent
    // stage-1 approve would have nothing to consume and stock would silently
    // not be deducted. The exclusion keeps inventory honest until admin acts.
    const [expired] = await conn.query(
      `SELECT id, product_id, quantity FROM stock_reservations
        WHERE state='held' AND expires_at < NOW()
          AND order_id NOT IN (
            SELECT CAST(order_id AS UNSIGNED)
              FROM advance_payment_verifications
             WHERE verification_stage = 'advance_shipping'
               AND status = 'pending'
          )
        ORDER BY product_id FOR UPDATE`,
    );

    for (const r of expired) {
      await conn.query(
        `UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?`,
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

// Convenience: launch the sweeper on a fixed interval. Call once from index.js.
// Avoids overlapping runs if a sweep takes longer than the interval.
function startReservationSweeper({ intervalMs = 5 * 60_000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const n = await sweepExpiredReservations();
      if (n > 0) console.log(`[stock-sweeper] released ${n} expired reservation(s)`);
    } catch (err) {
    } finally {
      running = false;
    }
  };
  setTimeout(tick, intervalMs).unref();
  setInterval(tick, intervalMs).unref();
}

module.exports = {
  RESERVATION_TTL_MINUTES,
  reserveStockForOrder,
  consumeReservationsForOrder,
  releaseReservationsForOrder,
  sweepExpiredReservations,
  startReservationSweeper,
  // Connection-aware variants for callers that already hold a transaction
  reserveStockOnConnection,
  consumeReservationsOnConnection,
  releaseReservationsOnConnection,
};
