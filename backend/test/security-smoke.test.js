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

test('public settings omit operational controls and contact details', () => {
  const { toPublicSettings, toPublicContactSettings } = require('../utils/adminSettings');

  const payload = {
    storeName: 'Naturanza Food',
    storeEmail: 'support@naturanzafood.com',
    storePhone: '+923409502646',
    address: 'Lahore, Pakistan',
    supportHours: '24/7',
    mapLatitude: 31.5204,
    mapLongitude: 74.3587,
    mapLocationLabel: 'Pakistan, Lahore',
    emailNotifications: true,
    orderNotifications: true,
    lowStockAlerts: true,
    lowStockThreshold: 10,
  };

  const publicSettings = toPublicSettings(payload);
  assert.equal(publicSettings.emailNotifications, undefined);
  assert.equal(publicSettings.orderNotifications, undefined);
  assert.equal(publicSettings.lowStockAlerts, undefined);
  assert.equal(publicSettings.lowStockThreshold, undefined);
  assert.equal(publicSettings.storePhone, undefined);
  assert.equal(publicSettings.address, undefined);
  assert.equal(publicSettings.supportHours, undefined);
  assert.equal(publicSettings.mapLatitude, undefined);

  const contactSettings = toPublicContactSettings(payload);
  assert.equal(contactSettings.storePhone, payload.storePhone);
  assert.equal(contactSettings.address, payload.address);
  assert.equal(contactSettings.supportHours, payload.supportHours);
  assert.equal(contactSettings.mapLatitude, payload.mapLatitude);
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
  // barcode is now exposed so the product page can publish Schema.org GTIN
  // (gtin8/gtin12/gtin13), which lets a phone scan / Google Lens resolve it.
  assert.equal(publicProduct.barcode, '2000000000007');
  assert.equal(publicProduct.qr_code_url, undefined);
  assert.deepEqual(publicProduct.images, [{ image_url: '/images/products/honey.webp', alt_text: null }]);
});
