const { hashToken } = require("./sessionManager");

const createRefreshTokenRecord = async (
  db,
  {
    userId,
    sessionId,
    refreshToken,
    refreshTokenJti,
    expiresAt,
    ipAddress = null,
    userAgent = null,
  },
) => {
  const tokenHash = hashToken(refreshToken);

  await db.query(
    `INSERT INTO refresh_tokens
      (user_id, session_id, jti, token_hash, expires_at, created_by_ip, user_agent, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [userId, sessionId, refreshTokenJti, tokenHash, expiresAt, ipAddress, userAgent],
  );
};

const findActiveRefreshTokenRecord = async (
  db,
  { refreshTokenJti, refreshToken },
) => {
  const tokenHash = hashToken(refreshToken);
  const [rows] = await db.query(
    `SELECT id, user_id, session_id, jti, token_hash, expires_at, revoked_at
     FROM refresh_tokens
     WHERE jti = ? AND token_hash = ?
     LIMIT 1`,
    [refreshTokenJti, tokenHash],
  );

  if (!rows.length) {
    return null;
  }

  const record = rows[0];
  const expiresAt = new Date(record.expires_at);
  const isExpired = Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date();
  const isRevoked = Boolean(record.revoked_at);

  return {
    ...record,
    isExpired,
    isRevoked,
  };
};

const rotateRefreshTokenRecord = async (
  db,
  {
    oldRefreshTokenJti,
    newRefreshToken,
    newRefreshTokenJti,
    expiresAt,
    userId,
    sessionId,
    ipAddress = null,
    userAgent = null,
  },
) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         revoked_reason = 'rotated',
         replaced_by_jti = ?
     WHERE jti = ? AND revoked_at IS NULL`,
    [newRefreshTokenJti, oldRefreshTokenJti],
  );

  await createRefreshTokenRecord(db, {
    userId,
    sessionId,
    refreshToken: newRefreshToken,
    refreshTokenJti: newRefreshTokenJti,
    expiresAt,
    ipAddress,
    userAgent,
  });
};

const revokeRefreshTokenByJti = async (db, refreshTokenJti, reason = "revoked") => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         revoked_reason = ?,
         last_used_at = NOW()
     WHERE jti = ? AND revoked_at IS NULL`,
    [reason, refreshTokenJti],
  );
};

const revokeRefreshTokensBySessionId = async (
  db,
  sessionId,
  reason = "session_revoked",
) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         revoked_reason = ?,
         last_used_at = NOW()
     WHERE session_id = ? AND revoked_at IS NULL`,
    [reason, sessionId],
  );
};

const revokeRefreshTokensByUserId = async (
  db,
  userId,
  reason = "security_revoke",
) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         revoked_reason = ?,
         last_used_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [reason, userId],
  );
};

const touchRefreshTokenByJti = async (db, refreshTokenJti) => {
  await db.query(
    `UPDATE refresh_tokens
     SET last_used_at = NOW()
     WHERE jti = ? AND revoked_at IS NULL`,
    [refreshTokenJti],
  );
};

const blacklistAccessToken = async (
  db,
  { jti, userId = null, token = null, expiresAt, reason = "logout" },
) => {
  if (!jti || !expiresAt) {
    return;
  }

  const tokenHash = token ? hashToken(token) : null;

  await db.query(
    `INSERT INTO token_blacklist (jti, token_hash, user_id, expires_at, reason)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       token_hash = VALUES(token_hash),
       user_id = VALUES(user_id),
       expires_at = VALUES(expires_at),
       reason = VALUES(reason)`,
    [jti, tokenHash, userId, expiresAt, reason],
  );
};

const isAccessTokenBlacklisted = async (db, jti) => {
  if (!jti) {
    return false;
  }

  const [rows] = await db.query(
    `SELECT id
     FROM token_blacklist
     WHERE jti = ? AND expires_at > NOW()
     LIMIT 1`,
    [jti],
  );

  return rows.length > 0;
};

module.exports = {
  createRefreshTokenRecord,
  findActiveRefreshTokenRecord,
  rotateRefreshTokenRecord,
  revokeRefreshTokenByJti,
  revokeRefreshTokensBySessionId,
  revokeRefreshTokensByUserId,
  touchRefreshTokenByJti,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
