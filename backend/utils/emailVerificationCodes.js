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
 * Returns { code, expiresInMinutes } — the raw code is for emailing only.
 */
const createVerificationCode = async (dbPool, userId, email) => {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await dbPool.query(
    "UPDATE email_verification_codes SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
    [userId],
  );

  await dbPool.query(
    `INSERT INTO email_verification_codes (user_id, email, code_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, String(email).toLowerCase(), codeHash, expiresAt],
  );

  return { code, expiresInMinutes: CODE_EXPIRY_MINUTES };
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

/**
 * Verify a submitted code for an email.
 * Returns { valid: true, userId } on success, or { valid: false, reason } otherwise.
 */
const verifyCode = async (dbPool, email, code) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cleanCode = String(code || "").trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, reason: "Please enter the 6-digit code." };
  }

  const [rows] = await dbPool.query(
    `SELECT id, user_id, code_hash, expires_at, attempts, is_used
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

  await dbPool.query(
    "UPDATE email_verification_codes SET is_used = TRUE, used_at = NOW() WHERE id = ?",
    [record.id],
  );

  return { valid: true, userId: record.user_id };
};

module.exports = {
  createVerificationCode,
  verifyCode,
  secondsUntilResendAllowed,
  CODE_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
};
