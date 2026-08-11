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
