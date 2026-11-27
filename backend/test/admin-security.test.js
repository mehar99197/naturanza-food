const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'x'.repeat(64);

test('ip allowlist CIDR parsing rejects invalid values', () => {
  const { parseCidr } = require('../utils/ipAllowlist');

  assert.equal(parseCidr('203.0.113.10')?.cidr, '203.0.113.10/32');
  assert.equal(parseCidr('203.0.113.0/24')?.prefix, 24);
  assert.equal(parseCidr('0.0.0.0/0')?.prefix, 0);
  assert.equal(parseCidr('999.1.1.1'), null);
  assert.equal(parseCidr('203.0.113.0/33'), null);
  assert.equal(parseCidr('203.0.113'), null);
  assert.equal(parseCidr(''), null);
  assert.equal(parseCidr(null), null);
});

test('ip allowlist matching covers exact, range, and mapped addresses', () => {
  const { ipMatchesCidr } = require('../utils/ipAllowlist');

  assert.equal(ipMatchesCidr('203.0.113.10', '203.0.113.10/32'), true);
  assert.equal(ipMatchesCidr('203.0.113.11', '203.0.113.10/32'), false);
  assert.equal(ipMatchesCidr('203.0.113.200', '203.0.113.0/24'), true);
  assert.equal(ipMatchesCidr('203.0.114.1', '203.0.113.0/24'), false);
  assert.equal(ipMatchesCidr('::ffff:203.0.113.10', '203.0.113.10/32'), true);
  assert.equal(ipMatchesCidr('198.51.100.7', '0.0.0.0/0'), true);
  assert.equal(ipMatchesCidr('not-an-ip', '203.0.113.0/24'), false);
});

test('totp setup encrypts the secret and verifies authenticator codes', () => {
  const { authenticator } = require('otplib');
  const {
    generateTwoFactorSetup,
    verifyTwoFactorCode,
    decryptSecret,
  } = require('../utils/totp');

  const setup = generateTwoFactorSetup({ email: 'admin@example.com' });
  assert.ok(setup.secret.length >= 16);
  assert.ok(setup.otpauthUrl.startsWith('otpauth://totp/'));
  assert.notEqual(setup.encryptedSecret, setup.secret);
  assert.equal(decryptSecret(setup.encryptedSecret), setup.secret);

  const code = authenticator.generate(setup.secret);
  assert.equal(verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code }), true);
  assert.equal(verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code: 'abcdef' }), false);
  assert.equal(verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code: '' }), false);
  assert.equal(verifyTwoFactorCode({ encryptedSecret: 'corrupted-value', code }), false);
});

test('recovery codes are hashed and single-use', async () => {
  const { generateRecoveryCodes, consumeRecoveryCode } = require('../utils/totp');

  const { codes, hashes } = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(hashes.length, 8);
  assert.ok(codes.every((code) => /^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code)));
  assert.ok(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.ok(!hashes.includes(codes[0]));

  const state = { stored: [...hashes] };
  const mockDb = {
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        return [[{ two_fa_recovery_codes: [...state.stored] }]];
      }
      if (sql.startsWith('UPDATE')) {
        state.stored = JSON.parse(params[0]);
        return [{}];
      }
      throw new Error('unexpected sql');
    },
  };

  const firstUse = await consumeRecoveryCode({ db: mockDb, userId: 1, code: codes[0] });
  assert.equal(firstUse, true);
  assert.equal(state.stored.length, 7);

  const replay = await consumeRecoveryCode({ db: mockDb, userId: 1, code: codes[0] });
  assert.equal(replay, false);

  const wrongCode = await consumeRecoveryCode({ db: mockDb, userId: 1, code: 'AAAAA-BBBBB' });
  assert.equal(wrongCode, false);
  assert.equal(state.stored.length, 7);
});

test('super admin allowlist allows all when empty and filters when configured', async () => {
  const { isSuperAdminIpAllowed } = require('../utils/adminSecurity');

  const emptyDb = { query: async () => [[]] };
  assert.equal(await isSuperAdminIpAllowed({ ipAddress: '198.51.100.4', database: emptyDb }), true);

  const configuredDb = { query: async () => [[{ cidr: '203.0.113.0/24' }]] };
  assert.equal(await isSuperAdminIpAllowed({ ipAddress: '203.0.113.9', database: configuredDb }), true);
  assert.equal(await isSuperAdminIpAllowed({ ipAddress: '198.51.100.9', database: configuredDb }), false);
});

test('trusted client IP ignores spoofable X-Forwarded-For', () => {
  const { getTrustedClientIp } = require('../utils/rateLimitKey');

  const request = {
    headers: {
      'x-forwarded-for': '203.0.113.99',
    },
    socket: {
      remoteAddress: '198.51.100.7',
    },
  };

  assert.equal(getTrustedClientIp(request), '198.51.100.7');
});

test('totp verification blocks immediate replay of the same code for a user', () => {
  const { authenticator } = require('otplib');
  const {
    generateTwoFactorSetup,
    verifyTwoFactorCode,
    _clearTotpReplayCache,
  } = require('../utils/totp');

  _clearTotpReplayCache();
  const setup = generateTwoFactorSetup({ email: 'replay@example.com' });
  const code = authenticator.generate(setup.secret);

  assert.equal(
    verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code, userId: 42 }),
    true,
    'first verification of a valid TOTP code must succeed',
  );
  assert.equal(
    verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code, userId: 42 }),
    false,
    'replaying the same TOTP code in the same time-step must be rejected',
  );
  // Different userId with same setup/code is tracked independently
  assert.equal(
    verifyTwoFactorCode({ encryptedSecret: setup.encryptedSecret, code, userId: 43 }),
    true,
  );
});

test('recovery codes use keyed HMAC-SHA256 while remaining backwards-compatible with legacy hashes', async () => {
  const crypto = require('node:crypto');
  const { generateRecoveryCodes, consumeRecoveryCode } = require('../utils/totp');

  const { codes, hashes } = generateRecoveryCodes();
  const plainSha256 = crypto
    .createHash('sha256')
    .update(codes[0].trim().toUpperCase())
    .digest('hex');
  assert.notEqual(
    hashes[0],
    plainSha256,
    'new recovery code hashes must be keyed HMAC-SHA256, not plain unsalted SHA-256',
  );

  // Legacy plain SHA-256 hash stored before upgrade must still be consumable once
  const legacyCode = 'ABCDE-12345';
  const legacyHash = crypto.createHash('sha256').update(legacyCode).digest('hex');
  const state = { stored: [legacyHash] };
  const mockDb = {
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        return [[{ two_fa_recovery_codes: [...state.stored] }]];
      }
      if (sql.startsWith('UPDATE')) {
        state.stored = JSON.parse(params[0]);
        return [{}];
      }
      throw new Error('unexpected sql');
    },
  };

  assert.equal(await consumeRecoveryCode({ db: mockDb, userId: 7, code: legacyCode }), true);
  assert.equal(state.stored.length, 0);
  assert.equal(await consumeRecoveryCode({ db: mockDb, userId: 7, code: legacyCode }), false);
});

test('csrfMiddleware ignores URL query-string _csrf tokens', () => {
  const { csrfMiddleware, generateToken, createSignedToken, CSRF_COOKIE_NAME } = require('../middleware/csrf');
  const middleware = csrfMiddleware({ cookieSecure: false, cookieSameSite: 'lax' });
  const signed = createSignedToken(generateToken());

  let statusCode = null;
  let calledNext = false;
  middleware(
    {
      method: 'POST',
      path: '/api/admin/settings',
      cookies: { [CSRF_COOKIE_NAME]: signed },
      headers: {},
      body: {},
      query: { _csrf: signed },
    },
    {
      status(code) {
        statusCode = code;
        return { json() {} };
      },
      cookie() {},
      clearCookie() {},
    },
    () => {
      calledNext = true;
    },
  );

  assert.equal(calledNext, false);
  assert.equal(statusCode, 403);
});

test('requireAdminRoutePermission fails closed on unmapped admin paths', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin.js'), 'utf8');
  const rules = source.slice(
    source.indexOf('const ADMIN_PERMISSION_RULES'),
    source.indexOf('router.use(requireAdminRoutePermission)'),
  );
  const requireAdminRoutePermission = new Function(
    'requirePermission',
    `${rules}; return requireAdminRoutePermission;`,
  )(() => (req, res, next) => next());

  const staff = { admin_role: 'staff_admin', admin_permissions: [] };
  let status = null;
  let nextCalled = false;
  requireAdminRoutePermission(
    { path: '/unmapped-future-endpoint', user: staff },
    { status: (code) => ({ json: () => { status = code; } }) },
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, false);
  assert.equal(status, 403);
});

test('admin hardening invariants hold across routes and index.js', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

  const indexSrc = read('index.js');
  assert.match(indexSrc, /\/api\/admin-management\/admins\/:id\/change-password",\s*authLimiter/);
  assert.match(indexSrc, /X-Step-Up-Password/);
  assert.match(indexSrc, /X-Step-Up-Otp/);

  const adminSrc = read('routes', 'admin.js');
  assert.match(adminSrc, /LOCATION_CACHE_MAX_ENTRIES/);
  assert.doesNotMatch(adminSrc, /req\.headers\["x-city"\]/);
  assert.doesNotMatch(adminSrc, /req\.headers\["cf-ipcity"\]/);

  const mgmtSrc = read('routes', 'adminManagement.js');
  assert.match(mgmtSrc, /ALLOWED_ADMIN_PERMISSIONS/);
  assert.match(mgmtSrc, /requireStepUp\(\)/);
  assert.match(mgmtSrc, /validateAndNormalizePermissions/);

  const secSrc = read('routes', 'adminSecurity.js');
  assert.match(secSrc, /requireStepUp\(\)/);
  assert.match(secSrc, /recordFailedLoginAtomic/);
});
