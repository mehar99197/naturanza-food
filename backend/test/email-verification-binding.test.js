/**
 * Pre-registration account-takeover regression tests (audit H-01).
 *
 * Anyone can register an address they do not own. Before these fixes the
 * submitted password was written straight onto the users row and stayed there
 * while the account sat unverified — so when the real owner later verified the
 * emailed code, the account activated carrying the attacker's password.
 *
 * The password is now held against the verification code that was issued for a
 * specific registration attempt, and is applied only when a nonce proves the
 * browser redeeming the code is the browser that registered. These tests drive
 * the real utils/emailVerificationCodes module against an in-memory stand-in for
 * the email_verification_codes table.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createVerificationCode,
  getPendingCredentialHash,
  verifyCode,
  claimVerificationCode,
} = require('../utils/emailVerificationCodes');

const EMAIL = 'victim@example.com';
const USER_ID = 7;

const makeDb = () => {
  const rows = [];
  let seq = 0;
  const latestFor = (email) =>
    rows.filter((r) => r.email === email).sort((a, b) => b.seq - a.seq)[0];

  return {
    rows,
    async query(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.startsWith('UPDATE email_verification_codes SET is_used = TRUE WHERE user_id')) {
        rows.filter((r) => r.user_id === params[0] && !r.is_used).forEach((r) => { r.is_used = true; });
        return [{}];
      }
      if (s.startsWith('INSERT INTO email_verification_codes')) {
        rows.push({
          id: rows.length + 1, user_id: params[0], email: params[1], code_hash: params[2],
          credential_hash: params[3], verifier_nonce_hash: params[4], expires_at: params[5],
          attempts: 0, is_used: false, seq: (seq += 1),
        });
        return [{}];
      }
      if (s.startsWith('SELECT credential_hash')) {
        const r = rows
          .filter((x) => x.user_id === params[0] && !x.is_used && new Date(x.expires_at) > new Date())
          .sort((a, b) => b.seq - a.seq)[0];
        return [r ? [{ credential_hash: r.credential_hash }] : []];
      }
      if (s.startsWith('SELECT id, user_id, code_hash')) {
        const r = latestFor(params[0]);
        return [r ? [r] : []];
      }
      if (s.startsWith('UPDATE email_verification_codes SET attempts')) {
        const r = rows.find((x) => x.id === params[0]);
        if (r) r.attempts += 1;
        return [{}];
      }
      if (s.startsWith('UPDATE email_verification_codes SET is_used = TRUE, used_at')) {
        const r = rows.find((x) => x.id === params[0] && !x.is_used && new Date(x.expires_at) > new Date());
        if (r) { r.is_used = true; return [{ affectedRows: 1 }]; }
        return [{ affectedRows: 0 }];
      }
      if (s.startsWith('UPDATE email_verification_codes SET is_used = TRUE WHERE id')) {
        const r = rows.find((x) => x.id === params[0]);
        if (r) r.is_used = true;
        return [{}];
      }
      throw new Error(`unhandled SQL in test stub: ${s.slice(0, 70)}`);
    },
  };
};

// Mirrors the decision POST /verify-email makes: validate without consuming, ask
// for a password when the code carries none attributable to this browser, then claim.
const verifyEmailHandler = async (db, code, cookieNonce, submittedPassword) => {
  const probe = await verifyCode(db, EMAIL, code, { verifierNonce: cookieNonce, claim: false });
  if (!probe.valid) return { status: 400, code: 'INVALID_CODE', reason: probe.reason };
  if (!probe.credentialHash && !submittedPassword) return { status: 400, code: 'PASSWORD_REQUIRED' };
  const applied = probe.credentialHash || `BCRYPT(${submittedPassword})`;
  if (!(await claimVerificationCode(db, probe.codeId))) return { status: 400, code: 'INVALID_CODE' };
  return { status: 200, applied };
};

test('normal signup applies the registrant\'s own password in one step', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_OWN' });

  const result = await verifyEmailHandler(db, issued.code, issued.verifierNonce);
  assert.equal(result.status, 200);
  assert.equal(result.applied, 'HASH_OWN', 'no password prompt for the ordinary path');
});

test('a pre-registered account never activates with the squatter\'s password', async () => {
  const db = makeDb();
  const attacker = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_ATTACKER' });

  // The owner holds the mailbox but did not register, so has no matching nonce.
  const firstAttempt = await verifyEmailHandler(db, attacker.code, null);
  assert.equal(firstAttempt.code, 'PASSWORD_REQUIRED');
  assert.equal(db.rows[0].is_used, false, 'the code must survive so the owner can retry');

  const retry = await verifyEmailHandler(db, attacker.code, null, 'MyOwnStr0ng!Pw');
  assert.equal(retry.status, 200);
  assert.equal(retry.applied, 'BCRYPT(MyOwnStr0ng!Pw)');
  assert.notEqual(retry.applied, 'HASH_ATTACKER');
});

test('re-registering by the owner invalidates the squatter\'s code', async () => {
  const db = makeDb();
  const attacker = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_ATTACKER' });
  const owner = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_OWNER' });

  const stale = await verifyEmailHandler(db, attacker.code, attacker.verifierNonce);
  assert.equal(stale.status, 400, 'the superseded code is dead');

  const fresh = await verifyEmailHandler(db, owner.code, owner.verifierNonce);
  assert.equal(fresh.applied, 'HASH_OWNER');
});

test('an attacker who re-registers last still cannot plant a password', async () => {
  const db = makeDb();
  const owner = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_OWNER' });
  // Attacker wins the race; their code is the one now sitting in the owner's inbox.
  const attacker = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_ATTACKER' });

  const prompted = await verifyEmailHandler(db, attacker.code, owner.verifierNonce);
  assert.equal(prompted.code, 'PASSWORD_REQUIRED', 'the owner\'s nonce no longer matches');

  const done = await verifyEmailHandler(db, attacker.code, owner.verifierNonce, 'MyOwnStr0ng!Pw');
  assert.equal(done.applied, 'BCRYPT(MyOwnStr0ng!Pw)');
});

test('a guessed or stolen nonce does not unlock the bound credential', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_ATTACKER' });

  const result = await verifyCode(db, EMAIL, issued.code, { verifierNonce: 'f'.repeat(64), claim: false });
  assert.equal(result.valid, true);
  assert.equal(result.credentialHash, null);
});

test('codes issued before the binding existed activate without a password', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: null });
  db.rows[0].verifier_nonce_hash = null; // pre-migration row

  const result = await verifyCode(db, EMAIL, issued.code, { verifierNonce: issued.verifierNonce, claim: false });
  assert.equal(result.valid, true);
  assert.equal(result.credentialHash, null);
});

test('resend carries the pending password forward', async () => {
  const db = makeDb();
  await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'HASH_OWN' });

  const carried = await getPendingCredentialHash(db, USER_ID);
  assert.equal(carried, 'HASH_OWN', 'a user who never got the first email must keep their password');

  const resent = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: carried });
  const result = await verifyEmailHandler(db, resent.code, resent.verifierNonce);
  assert.equal(result.applied, 'HASH_OWN');
});

test('validating without claiming keeps brute-force protection intact', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'H' });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await verifyEmailHandler(db, '000000', issued.verifierNonce);
  }

  const afterCap = await verifyEmailHandler(db, issued.code, issued.verifierNonce);
  assert.equal(afterCap.status, 400, 'the correct code is refused once the attempt cap is hit');
  assert.equal(db.rows[0].is_used, true, 'the code is burned by the cap');
});

test('probing a correct code repeatedly does not consume it', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'H2' });

  for (let i = 0; i < 3; i += 1) {
    await verifyCode(db, EMAIL, issued.code, { verifierNonce: null, claim: false });
  }

  const result = await verifyEmailHandler(db, issued.code, issued.verifierNonce);
  assert.equal(result.applied, 'H2');
});

test('a redeemed code cannot be replayed', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'H' });

  assert.equal((await verifyEmailHandler(db, issued.code, issued.verifierNonce)).status, 200);
  assert.equal((await verifyEmailHandler(db, issued.code, issued.verifierNonce)).status, 400);
});

test('an expired code is refused', async () => {
  const db = makeDb();
  const issued = await createVerificationCode(db, USER_ID, EMAIL, { credentialHash: 'H' });
  db.rows[0].expires_at = new Date(Date.now() - 1000);

  const result = await verifyEmailHandler(db, issued.code, issued.verifierNonce);
  assert.equal(result.status, 400);
});
