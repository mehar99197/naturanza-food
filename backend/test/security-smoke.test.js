const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'x'.repeat(64);

test('token cleanup and cookie exports are available', () => {
  const tokenStore = require('../utils/tokenStore');
  const jwtTokens = require('../utils/jwtTokens');

  assert.equal(typeof tokenStore.startBlacklistCleanup, 'function');
  assert.equal(jwtTokens.REFRESH_COOKIE_NAME, 'refreshToken');
});

test('progressive login delay is bounded', () => {
  const { progressiveDelayMs } = require('../utils/loginSecurity');

  assert.equal(progressiveDelayMs(0), 0);
  assert.equal(progressiveDelayMs(1), 1500);
  assert.equal(progressiveDelayMs(100), 30000);
});

test('session manager and schema helpers load without a database connection', () => {
  const sessionManager = require('../utils/sessionManager');
  const schemaCompatibility = require('../utils/schemaCompatibility');

  assert.equal(typeof sessionManager.createUserSession, 'function');
  assert.equal(typeof schemaCompatibility.ensureProductionSchema, 'function');
});

test('admin status validation rejects arbitrary values', () => {
  const adminManagement = require('../routes/adminManagement');

  assert.equal(adminManagement.isValidAdminStatus('active'), true);
  assert.equal(adminManagement.isValidAdminStatus('inactive'), true);
  assert.equal(adminManagement.isValidAdminStatus('anything'), false);
  assert.equal(adminManagement.isValidAdminStatus(undefined), false);
});

test('admin authorization recognizes explicit admin roles and rejects customers', () => {
  const { isAdminUser } = require('../middleware/auth');

  assert.equal(isAdminUser({ role: 'customer', admin_role: null }), false);
  assert.equal(isAdminUser({ role: 'admin', admin_role: 'staff_admin' }), true);
  assert.equal(isAdminUser({ role: 'customer', admin_role: 'super_admin' }), true);
  assert.equal(isAdminUser({ role: 'customer', admin_role: 'unknown' }), false);
});

test('variant JSON parsing safely falls back for malformed values', () => {
  const variants = require('../routes/variants');

  assert.deepEqual(variants.parseJsonSafely('{"color":"green"}', {}), { color: 'green' });
  assert.deepEqual(variants.parseJsonSafely('{broken', {}), {});
  assert.deepEqual(variants.parseJsonSafely(null, []), []);
});

test('public settings omit operational controls', () => {
  const { toPublicSettings } = require('../utils/adminSettings');

  const publicSettings = toPublicSettings({
    storeName: 'Naturanza Food',
    storeEmail: 'support@naturanzafood.com',
    emailNotifications: true,
    orderNotifications: true,
    lowStockAlerts: true,
    lowStockThreshold: 10,
  });

  assert.equal(publicSettings.emailNotifications, undefined);
  assert.equal(publicSettings.orderNotifications, undefined);
  assert.equal(publicSettings.lowStockAlerts, undefined);
  assert.equal(publicSettings.lowStockThreshold, undefined);
});

test('public products expose availability without inventory details', () => {
  const { toPublicProduct } = require('../controllers/productController');

  const publicProduct = toPublicProduct({
    id: 7,
    name: 'Honey',
    stock_quantity: 20,
    reserved_stock: 5,
    barcode: '2000000000007',
    qr_code_url: 'https://naturanzafood.com/product/7',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    images: [{ id: 1, image_url: '/images/products/honey.webp', created_at: 'now' }],
  });

  assert.equal(publicProduct.is_in_stock, true);
  assert.equal(publicProduct.stock_quantity, undefined);
  assert.equal(publicProduct.reserved_stock, undefined);
  assert.equal(publicProduct.barcode, undefined);
  assert.equal(publicProduct.qr_code_url, undefined);
  assert.deepEqual(publicProduct.images, [{ image_url: '/images/products/honey.webp', alt_text: null }]);
});
