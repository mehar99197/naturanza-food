const crypto = require('crypto');

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const createUserSession = async (
  db,
  { userId, token, provider = 'password', ipAddress = null, userAgent = null },
) => {
  if (!db || !userId || !token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const [result] = await db.query(
    `INSERT INTO user_sessions (user_id, token_hash, login_provider, ip_address, user_agent, is_active, last_seen_at)
     VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
    [userId, tokenHash, provider, ipAddress, userAgent],
  );

  return result?.insertId || null;
};

const updateSessionToken = async (db, sessionId, token) => {
  if (!db || !sessionId || !token) {
    return;
  }

  const tokenHash = hashToken(token);
  await db.query(
    `UPDATE user_sessions
     SET token_hash = ?,
         last_seen_at = NOW()
     WHERE id = ? AND is_active = TRUE`,
    [tokenHash, sessionId],
  );
};

const revokeSessionByToken = async (db, token) => {
  if (!db || !token) {
    return;
  }

  const tokenHash = hashToken(token);
  await db.query(
    `UPDATE user_sessions
     SET is_active = FALSE,
         revoked_at = NOW(),
         last_seen_at = NOW()
     WHERE token_hash = ?`,
    [tokenHash],
  );
};

const revokeSessionById = async (db, sessionId) => {
  if (!db || !sessionId) {
    return;
  }

  await db.query(
    `UPDATE user_sessions
     SET is_active = FALSE,
         revoked_at = NOW(),
         last_seen_at = NOW()
     WHERE id = ?`,
    [sessionId],
  );
};

const revokeSessionsByUserId = async (db, userId, exceptSessionId = null) => {
  if (!db || !userId) {
    return;
  }

  const params = [userId];
  let query =
    `UPDATE user_sessions
     SET is_active = FALSE,
         revoked_at = NOW(),
         last_seen_at = NOW()
     WHERE user_id = ?`;

  if (exceptSessionId) {
    query += " AND id <> ?";
    params.push(exceptSessionId);
  }

  await db.query(query, params);
};

const touchSessionByToken = async (db, token) => {
  if (!db || !token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const [rows] = await db.query(
    'SELECT id, user_id, is_active FROM user_sessions WHERE token_hash = ? LIMIT 1',
    [tokenHash],
  );

  if (rows.length === 0) {
    return null;
  }

  const session = rows[0];
  if (!session.is_active) {
    return session;
  }

  await db.query('UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?', [
    session.id,
  ]);

  return session;
};

module.exports = {
  hashToken,
  createUserSession,
  updateSessionToken,
  revokeSessionByToken,
  revokeSessionById,
  revokeSessionsByUserId,
  touchSessionByToken,
};
