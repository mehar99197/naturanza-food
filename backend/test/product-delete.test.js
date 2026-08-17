/**
 * Regression tests for deleting a product from the admin Products section.
 *
 * Deleting used to only set is_active = FALSE. The admin list asks for inactive
 * rows (includeInactive), so a "deleted" product never left the screen, and the
 * next click on Delete answered 404 "Product not found" because the UPDATE
 * required is_active = TRUE and MySQL reports affectedRows = 0 when nothing
 * changes. Deliberately DB-free — these cover the decision logic, with the
 * connection stubbed so the SQL each branch issues is still asserted.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Stand in for config/db before productModel destructures it, so requiring the
// model never opens a MySQL pool.
const dbModulePath = require.resolve('../config/db');
require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: {
    dbPool: { query: async () => [[]] },
    db: { promise: () => ({ query: async () => [[]] }) },
    withTransaction: async (run) => run(currentConnection),
    testDatabaseConnection: async () => true,
  },
};

let currentConnection = null;

const normalize = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const createConnection = ({ product = null, orderCount = 0, deleteFails = false } = {}) => {
  const queries = [];

  return {
    queries,
    find: (fragment) => queries.find((entry) => entry.sql.includes(fragment)),
    query: async (sql, params = []) => {
      const text = normalize(sql);
      queries.push({ sql: text, params });

      if (text.includes('FROM products WHERE id = ?') && text.includes('FOR UPDATE')) {
        return [product ? [product] : []];
      }

      if (text.includes('COUNT(*) AS orderCount')) {
        return [[{ orderCount }]];
      }

      if (text.includes('WHERE slug = ?')) {
        return [[]];
      }

      if (text.startsWith('DELETE FROM products')) {
        if (deleteFails) {
          const error = new Error('Cannot delete or update a parent row');
          error.errno = 1451;
          throw error;
        }
        return [{ affectedRows: 1 }];
      }

      return [{ affectedRows: 1 }];
    },
  };
};

const deleteProductId = async (id, connectionOptions) => {
  currentConnection = createConnection(connectionOptions);
  const result = await productModel.deleteById(id);
  return { result, connection: currentConnection };
};

const productModel = require('../models/productModel');
const productController = require('../controllers/productController');

test('a product nobody has ordered is removed outright', async () => {
  const { result, connection } = await deleteProductId(7, {
    product: { id: 7, slug: 'organic-honey', deleted_at: null },
    orderCount: 0,
  });

  assert.deepEqual(result, { outcome: 'removed', orderCount: 0 });
  assert.ok(connection.find('DELETE FROM products'), 'the row must actually be deleted');
  assert.ok(!connection.find('UPDATE products'), 'no archived copy is left behind');
});

test('an ordered product is stamped deleted_at and gives up its slug and barcode', async () => {
  // The row has to survive: order_items.product_id is ON DELETE CASCADE and an
  // order line stores no product name, so removing it would erase invoice lines.
  const { result, connection } = await deleteProductId(7, {
    product: { id: 7, slug: 'organic-honey', deleted_at: null },
    orderCount: 3,
  });

  assert.deepEqual(result, { outcome: 'archived', orderCount: 3 });
  assert.ok(!connection.find('DELETE FROM products'), 'paid order lines must not be erased');

  const update = connection.find('UPDATE products');
  assert.match(update.sql, /deleted_at = NOW\(\)/, 'deleted_at is what hides it from every list');
  assert.match(update.sql, /is_active = FALSE/);
  assert.match(update.sql, /barcode = NULL/, 'the barcode is freed for a re-created product');
  assert.deepEqual(update.params, ['organic-honey-deleted-7', 7]);
});

test('deleting an already-deleted product succeeds instead of raising 404', async () => {
  const { result, connection } = await deleteProductId(7, {
    product: { id: 7, slug: 'organic-honey-deleted-7', deleted_at: new Date('2026-08-17') },
    orderCount: 3,
  });

  assert.deepEqual(result, { outcome: 'already-deleted', orderCount: 0 });
  assert.equal(connection.queries.length, 1, 'a row already gone is not touched again');
});

test('an id that never existed reports the product as gone, not as an error', async () => {
  const { result } = await deleteProductId(4242, { product: null });

  assert.equal(result.outcome, 'already-deleted');
});

test('a child table that still uses RESTRICT falls back to archiving', async () => {
  const { result, connection } = await deleteProductId(7, {
    product: { id: 7, slug: 'organic-honey', deleted_at: null },
    orderCount: 0,
    deleteFails: true,
  });

  assert.equal(result.outcome, 'archived');
  assert.ok(connection.find('UPDATE products'), 'the delete is downgraded, not failed');
});

test('the delete endpoint answers 200 for a product that is already gone', async () => {
  const originalDeleteById = productModel.deleteById;
  productModel.deleteById = async () => ({ outcome: 'already-deleted', orderCount: 0 });

  try {
    let statusCode = 200;
    let payload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
        return this;
      },
    };

    await productController.deleteProduct({ params: { id: '7' } }, res);

    assert.equal(statusCode, 200, 'a second click must not surface "Product not found"');
    assert.equal(payload.archived, false);
    assert.match(payload.message, /already deleted/i);
  } finally {
    productModel.deleteById = originalDeleteById;
  }
});
