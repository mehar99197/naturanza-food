/**
 * Email verification codes (6-digit OTP) for self-signup accounts.
 *
 * Mirrors the password-reset token pattern: only the SHA-256 hash of the code is
 * stored, codes expire, attempts are capped (to stop brute force of the 10^6
 * space), and a resend cooldown prevents email-bombing.
 */
const crypto = require("crypto");

const CODE_EXPIRY_MINUTES = Math.max(
  5,
  Number.parseInt(process.env.EMAIL_VERIFICATION_CODE_MINUTES || "15", 10) || 15,
);
const MAX_ATTEMPTS = 6; // wrong-guess attempts allowed per code before it's burned
const RESEND_COOLDOWN_SECONDS = 60; // min seconds between sending new codes

const generateCode = () => {
  // 6-digit numeric, cryptographically random, zero-padded.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
};

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

/**
 * Create + store a fresh verification code for a user, invalidating older ones.
 *
 * `credentialHash` is the bcrypt hash of the password submitted with THIS
 * registration attempt. It is held here rather than on the users row so an
 * unverified account never carries a usable credential: whoever registered an
 * address they do not own cannot leave a working password behind for the real
 * owner to activate. It is applied to users.password at verification time.
 *
 * The returned `verifierNonce` goes to the registrant's browser in an HttpOnly
 * cookie; only its hash is stored. Verification compares the two so it can tell
 * the registrant from someone completing a registration that is not theirs.
 *
 * Returns { code, expiresInMinutes, verifierNonce } — `code` is for emailing
 * only, `verifierNonce` is for the cookie only. Neither is stored in the clear.
 */
const createVerificationCode = async (
  dbPool,
  userId,
  email,
  { credentialHash = null } = {},
) => {
  const code = generateCode();
  const codeHash = hashCode(code);
  const verifierNonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await dbPool.query(
    "UPDATE email_verification_codes SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
    [userId],
  );

  await dbPool.query(
    `INSERT INTO email_verification_codes
       (user_id, email, code_hash, credential_hash, verifier_nonce_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      String(email).toLowerCase(),
      codeHash,
      credentialHash,
      hashCode(verifierNonce),
      expiresAt,
    ],
  );

  return { code, expiresInMinutes: CODE_EXPIRY_MINUTES, verifierNonce };
};

/**
 * The credential still pending on a user's most recent unused code.
 *
 * "Resend code" must carry the original registration's password forward, or a
 * user who simply did not receive the first email would finish verification
 * with no password at all.
 */
const getPendingCredentialHash = async (dbPool, userId) => {
  const [rows] = await dbPool.query(
    `SELECT credential_hash
       FROM email_verification_codes
      WHERE user_id = ? AND is_used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );

  return rows[0]?.credential_hash || null;
};

/**
 * How many seconds the caller must wait before a new code can be sent.
 * 0 means "ok to send now".
 */
const secondsUntilResendAllowed = async (dbPool, userId) => {
  const [rows] = await dbPool.query(
    `SELECT created_at FROM email_verification_codes
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  if (!rows.length) {
    return 0;
  }
  const last = new Date(rows[0].created_at).getTime();
  const elapsed = (Date.now() - last) / 1000;
  const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
  return remaining > 0 ? remaining : 0;
};

// Constant-time compare of two hex digests of equal, fixed length.
const nonceMatches = (submittedNonce, storedNonceHash) => {
  if (!submittedNonce || !storedNonceHash) {
    return false;
  }

  const submitted = Buffer.from(hashCode(submittedNonce), "utf8");
  const stored = Buffer.from(String(storedNonceHash), "utf8");
  if (submitted.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(submitted, stored);
};

/**
 * Verify a submitted code for an email.
 *
 * Returns { valid: true, userId, credentialHash, codeId } on success, or
 * { valid: false, reason } otherwise. `credentialHash` is non-null only when
 * `verifierNonce` proves this is the same browser that registered — otherwise
 * the caller must obtain a password from the person redeeming the code, because
 * a password from someone else's registration attempt must never be applied.
 *
 * Pass `claim: false` to validate WITHOUT consuming the code. The caller then
 * calls claimVerificationCode() once it can actually complete activation — that
 * two-step exists so "this code needs a password" can be answered without
 * burning the code and stranding the user. Wrong guesses still increment
 * `attempts` on the check pass, so brute-force protection is unaffected.
 */
const verifyCode = async (
  dbPool,
  email,
  code,
  { verifierNonce = null, claim = true } = {},
) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cleanCode = String(code || "").trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, reason: "Please enter the 6-digit code." };
  }

  const [rows] = await dbPool.query(
    `SELECT id, user_id, code_hash, credential_hash, verifier_nonce_hash,
            expires_at, attempts, is_used
     FROM email_verification_codes
     WHERE email = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail],
  );

  if (!rows.length) {
    return { valid: false, reason: "No verification code found. Please request a new one." };
  }

  const record = rows[0];

  if (record.is_used) {
    return { valid: false, reason: "This code was already used. Please request a new one." };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, reason: "This code has expired. Please request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await dbPool.query(
      "UPDATE email_verification_codes SET is_used = TRUE WHERE id = ?",
      [record.id],
    );
    return { valid: false, reason: "Too many attempts. Please request a new code." };
  }

  if (hashCode(cleanCode) !== record.code_hash) {
    await dbPool.query(
      "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?",
      [record.id],
    );
    return { valid: false, reason: "Incorrect code. Please try again." };
  }

  if (claim && !(await claimVerificationCode(dbPool, record.id))) {
    return { valid: false, reason: "This code was already used. Please request a new one." };
  }

  return {
    valid: true,
    userId: record.user_id,
    codeId: record.id,
    credentialHash: nonceMatches(verifierNonce, record.verifier_nonce_hash)
      ? record.credential_hash || null
      : null,
  };
};

/**
 * Consume a code that verifyCode() already validated with `claim: false`.
 * Atomic, so two requests racing the same code cannot both succeed.
 * Returns true when this caller is the one that consumed it.
 */
const claimVerificationCode = async (dbPool, codeId) => {
  const [result] = await dbPool.query(
    `UPDATE email_verification_codes
        SET is_used = TRUE, used_at = NOW()
      WHERE id = ? AND is_used = FALSE AND expires_at > NOW()`,
    [codeId],
  );

  return result.affectedRows === 1;
};

module.exports = {
  createVerificationCode,
  getPendingCredentialHash,
  verifyCode,
  claimVerificationCode,
  secondsUntilResendAllowed,
  CODE_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
};
