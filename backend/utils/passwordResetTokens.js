/**
 * Password Reset Token Management
 * Handles secure token generation, storage, and validation for password resets
 */

const crypto = require("crypto");

// Token expiry time in minutes
const TOKEN_EXPIRY_MINUTES = Math.max(
  5,
  Number.parseInt(process.env.PASSWORD_RESET_TOKEN_MINUTES || "30", 10) || 30,
);

/**
 * Generate a secure random token
 * Uses crypto.randomBytes for cryptographically secure random values
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hash a token for secure storage
 * We store hashed tokens in the database to prevent token theft from DB breaches
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Create a password reset token for a user
 * Returns the raw token (to be sent via email) - only the hash is stored
 */
const createPasswordResetToken = async (dbPool, userId, email) => {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // First, invalidate any existing tokens for this user
  await dbPool.query(
    "UPDATE password_reset_tokens SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
    [userId]
  );

  // Insert new token
  await dbPool.query(
    `INSERT INTO password_reset_tokens (user_id, email, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, email.toLowerCase(), tokenHash, expiresAt]
  );

  return {
    token: rawToken,
    expiresAt,
    expiresInMinutes: TOKEN_EXPIRY_MINUTES,
  };
};

/**
 * Validate a password reset token
 * Returns user info if valid, null if invalid/expired/used
 */
const validatePasswordResetToken = async (dbPool, rawToken) => {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const [rows] = await dbPool.query(
    `SELECT prt.id, prt.user_id, prt.email, prt.expires_at, prt.is_used,
            u.name as user_name, u.is_active as user_active
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) {
    return null;
  }

  const record = rows[0];

  // Check if token is already used
  if (record.is_used) {
    return { valid: false, reason: "Token has already been used" };
  }

  // Check if token is expired
  const expiresAt = new Date(record.expires_at);
  if (expiresAt < new Date()) {
    return { valid: false, reason: "Token has expired" };
  }

  // Check if user account is active
  if (!record.user_active) {
    return { valid: false, reason: "User account is not active" };
  }

  return {
    valid: true,
    tokenId: record.id,
    userId: record.user_id,
    email: record.email,
    userName: record.user_name,
    expiresAt: record.expires_at,
  };
};

/**
 * Mark a token as used after successful password reset
 */
const markTokenAsUsed = async (dbPool, tokenId) => {
  await dbPool.query(
    "UPDATE password_reset_tokens SET is_used = TRUE, used_at = NOW() WHERE id = ?",
    [tokenId]
  );
};

/**
 * Invalidate all tokens for a user (e.g., after password change)
 */
const invalidateAllUserTokens = async (dbPool, userId) => {
  await dbPool.query(
    "UPDATE password_reset_tokens SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
    [userId]
  );
};

/**
 * Clean up expired tokens (can be run periodically)
 */
const cleanupExpiredTokens = async (dbPool) => {
  const result = await dbPool.query(
    "DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR (is_used = TRUE AND used_at < DATE_SUB(NOW(), INTERVAL 7 DAY))"
  );
  return result[0]?.affectedRows || 0;
};

module.exports = {
  generateSecureToken,
  hashToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  invalidateAllUserTokens,
  cleanupExpiredTokens,
  TOKEN_EXPIRY_MINUTES,
};
