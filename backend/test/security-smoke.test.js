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

test('variant JSON parsing safely falls back for malformed values', () => {
  const variants = require('../routes/variants');

  assert.deepEqual(variants.parseJsonSafely('{"color":"green"}', {}), { color: 'green' });
  assert.deepEqual(variants.parseJsonSafely('{broken', {}), {});
  assert.deepEqual(variants.parseJsonSafely(null, []), []);
});
