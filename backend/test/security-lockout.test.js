const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'x'.repeat(64);

const {
  recordFailedLoginAtomic,
  resetLoginFailuresAtomic,
  checkAccountLockout,
} = require('../utils/loginSecurity');

const createFakeConnection = (initialRows = []) => {
  const queries = [];
  let rows = Array.isArray(initialRows) ? initialRows : [initialRows];

  const query = async (sql, params) => {
    queries.push({ sql, params });
    // SELECT returns current rows; UPDATE returns affectedRows.
    if (/^\s*SELECT/i.test(sql)) {
      return [rows];
    }
    if (/^\s*UPDATE/i.test(sql)) {
      return [{ affectedRows: 1 }];
    }
    return [];
  };

  return {
    query,
    getQueries: () => queries,
    setRows: (newRows) => { rows = newRows; },
  };
};

test('recordFailedLoginAtomic increments attempts without locking', async () => {
  const db = createFakeConnection({
    user_failed_login_attempts: 1,
    user_locked_until: null,
  });

  const result = await recordFailedLoginAtomic(db, 7, 'test@example.com', false);

  assert.equal(result.locked, false);
  assert.equal(result.attemptsLeft, 3);

  const update = db.getQueries().find((q) => /^\s*UPDATE/i.test(q.sql));
  assert.ok(update);
  assert.equal(update.params[0], 2);
  assert.equal(update.params[1], null);
});

test('recordFailedLoginAtomic locks after threshold and doubles lock duration', async () => {
  const db = createFakeConnection({
    user_failed_login_attempts: 4,
    user_locked_until: null,
  });

  const result = await recordFailedLoginAtomic(db, 7, 'test@example.com', false);

  assert.equal(result.locked, true);
  assert.equal(result.attemptsLeft, 0);

  const update = db.getQueries().find((q) => /^\s*UPDATE/i.test(q.sql));
  assert.ok(update);
  assert.equal(update.params[0], 5);
  assert.ok(update.params[1] instanceof Date);
  // First lock uses base duration (default 15 minutes).
  const durationMinutes = (update.params[1].getTime() - Date.now()) / 1000 / 60;
  assert.ok(durationMinutes >= 14 && durationMinutes <= 16);
});

test('recordFailedLoginAtomic applies exponential backoff on repeated locks', async () => {
  const db = createFakeConnection({
    user_failed_login_attempts: 6,
    user_locked_until: null,
  });

  const result = await recordFailedLoginAtomic(db, 7, 'test@example.com', false);

  assert.equal(result.locked, true);

  const update = db.getQueries().find((q) => /^\s*UPDATE/i.test(q.sql));
  const durationMinutes = (update.params[1].getTime() - Date.now()) / 1000 / 60;
  // 6 attempts means 1 overflow past threshold -> multiplier 2 -> 30 min.
  assert.ok(durationMinutes >= 29 && durationMinutes <= 31);
});

test('checkAccountLockout reports active lock', async () => {
  const lockUntil = new Date(Date.now() + 10 * 60 * 1000);
  const db = createFakeConnection({
    user_failed_login_attempts: 5,
    user_locked_until: lockUntil,
  });

  const result = await checkAccountLockout(db, 7, false);

  assert.equal(result.locked, true);
  assert.equal(result.attemptsLeft, 0);
});

test('checkAccountLockout clears expired lock', async () => {
  const db = createFakeConnection({
    user_failed_login_attempts: 5,
    user_locked_until: new Date(Date.now() - 10 * 60 * 1000),
  });

  const result = await checkAccountLockout(db, 7, false);

  assert.equal(result.locked, false);
  const update = db.getQueries().find((q) => /^\s*UPDATE/i.test(q.sql));
  assert.ok(update);
  assert.ok(update.sql.includes('user_failed_login_attempts = 0'));
});

test('resetLoginFailuresAtomic resets both user and admin counters', async () => {
  const db = createFakeConnection();

  await resetLoginFailuresAtomic(db, 7);

  const update = db.getQueries().find((q) => /^\s*UPDATE/i.test(q.sql));
  assert.ok(update);
  assert.ok(update.sql.includes('user_failed_login_attempts = 0'));
  assert.ok(update.sql.includes('admin_failed_login_attempts = 0'));
  assert.ok(update.sql.includes('user_locked_until = NULL'));
  assert.ok(update.sql.includes('admin_locked_until = NULL'));
});
