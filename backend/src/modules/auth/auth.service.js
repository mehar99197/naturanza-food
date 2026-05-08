const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { pool } = require("../../config/db");
const { env } = require("../../config/env");
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../../security/jwt");

const parseBoundedInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

// Keep bcrypt cost safely bounded to avoid accidental CPU exhaustion.
const BCRYPT_ROUNDS = parseBoundedInt(env.BCRYPT_ROUNDS, 12, 10, 16);
// Rate limit strategy: edge/IP throttling in middleware + per-account lockout here.
const LOGIN_MAX_ATTEMPTS = parseBoundedInt(env.LOGIN_MAX_ATTEMPTS, 5, 3, 20);
const LOGIN_LOCK_MINUTES = parseBoundedInt(env.LOGIN_LOCK_MINUTES, 15, 5, 1440);

const serviceError = (
  message,
  statusCode = 400,
  code = "AUTH_SERVICE_ERROR",
) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.isOperational = true;
  return err;
};

const hashToken = (value) =>
  crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const toSafeUser = (row = {}) => {
  const id = Number.parseInt(String(row.id ?? ""), 10);
  const email = normalizeEmail(row.email);
  const role = String(row.role || "customer").trim().toLowerCase() || "customer";
  const name = row.name ? String(row.name).trim() : null;

  if (!Number.isFinite(id) || id <= 0 || !email) {
    throw serviceError("Invalid user record", 500, "INVALID_USER_RECORD");
  }

  return {
    id,
    email,
    role,
    name,
  };
};

const isFutureDate = (value) => {
  if (!value) return false;
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) && dt.getTime() > Date.now();
};

const revokeRefreshFamily = async (connection, familyId, reason) => {
  if (!familyId) {
    return;
  }

  // Family-level revocation is a containment action: one stolen/replayed token
  // invalidates every descendant token in the same refresh chain.
  await connection.execute(
    `UPDATE refresh_tokens
     SET revoked_at = UTC_TIMESTAMP(),
         revoke_reason = COALESCE(revoke_reason, ?)
     WHERE family_id = ? AND revoked_at IS NULL`,
    [reason, familyId],
  );

  await connection.execute(
    `UPDATE user_sessions
     SET is_active = 0,
         revoked_at = UTC_TIMESTAMP(),
         revoke_reason = COALESCE(revoke_reason, ?)
     WHERE refresh_family_id = ? AND is_active = 1`,
    [reason, familyId],
  );
};

const createInitialSession = async (connection, { user, ipAddress, userAgent }) => {
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();

  const access = signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId,
    extraClaims: { email: user.email },
  });

  const refresh = signRefreshToken({
    userId: user.id,
    role: user.role,
    sessionId,
    familyId,
    extraClaims: { email: user.email },
  });

  // Decode issued token once to get canonical expiry from JWT claims.
  const refreshPayload = verifyRefreshToken(refresh.token);

  await connection.execute(
    `INSERT INTO user_sessions
      (session_id, user_id, refresh_family_id, ip_address, user_agent, is_active, last_seen_at)
     VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP())`,
    [sessionId, user.id, familyId, ipAddress || null, userAgent || null],
  );

  await connection.execute(
    `INSERT INTO refresh_tokens
      (token_jti, user_id, session_id, family_id, parent_jti, token_hash, expires_at, created_ip, created_user_agent)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    [
      refresh.jti,
      user.id,
      sessionId,
      familyId,
      hashToken(refresh.token),
      refreshPayload.expiresAt,
      ipAddress || null,
      userAgent || null,
    ],
  );

  return {
    user,
    tokens: {
      accessToken: access.token,
      refreshToken: refresh.token,
      sessionId,
      familyId,
      accessTokenJti: access.jti,
      refreshTokenJti: refresh.jti,
    },
  };
};

const rotateRefreshToken = async (
  connection,
  {
    user,
    sessionId,
    familyId,
    currentRefreshJti,
    ipAddress,
    userAgent,
  },
) => {
  const access = signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId,
    extraClaims: { email: user.email },
  });

  const refresh = signRefreshToken({
    userId: user.id,
    role: user.role,
    sessionId,
    familyId,
    parentJti: currentRefreshJti,
    extraClaims: { email: user.email },
  });

  const refreshPayload = verifyRefreshToken(refresh.token);

  const [markUsedResult] = await connection.execute(
    `UPDATE refresh_tokens
     SET used_at = UTC_TIMESTAMP(),
         rotated_at = UTC_TIMESTAMP(),
         replaced_by_jti = ?
     WHERE token_jti = ? AND used_at IS NULL AND revoked_at IS NULL`,
    [refresh.jti, currentRefreshJti],
  );

  if (Number(markUsedResult.affectedRows || 0) !== 1) {
    // If we cannot atomically consume the current token, another request likely
    // raced or replayed it. Revoke the full family and force re-authentication.
    await revokeRefreshFamily(connection, familyId, "refresh-race-reuse-detected");
    throw serviceError(
      "Session invalid. Please login again.",
      401,
      "REFRESH_REUSE_DETECTED",
    );
  }

  await connection.execute(
    `INSERT INTO refresh_tokens
      (token_jti, user_id, session_id, family_id, parent_jti, token_hash, expires_at, created_ip, created_user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      refresh.jti,
      user.id,
      sessionId,
      familyId,
      currentRefreshJti,
      hashToken(refresh.token),
      refreshPayload.expiresAt,
      ipAddress || null,
      userAgent || null,
    ],
  );

  await connection.execute(
    "UPDATE user_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE session_id = ?",
    [sessionId],
  );

  return {
    user,
    tokens: {
      accessToken: access.token,
      refreshToken: refresh.token,
      sessionId,
      familyId,
      accessTokenJti: access.jti,
      refreshTokenJti: refresh.jti,
    },
  };
};

const registerUser = async (
  { email, password, name },
  context = {},
) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = typeof name === "string" ? name.trim() : null;

  if (!normalizedEmail) {
    throw serviceError("Email is required", 400, "INVALID_EMAIL");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      "SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1",
      [normalizedEmail],
    );

    if (existingRows.length > 0) {
      throw serviceError("Email is already registered", 409, "EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [insertResult] = await connection.execute(
      `INSERT INTO users
        (email, password, role, is_active, failed_login_attempts, locked_until, password_changed_at)
       VALUES (?, ?, 'customer', 1, 0, NULL, UTC_TIMESTAMP())`,
      [normalizedEmail, passwordHash],
    );

    const safeUser = toSafeUser({
      id: Number(insertResult.insertId),
      email: normalizedEmail,
      role: "customer",
      name: normalizedName,
    });

    const sessionBundle = await createInitialSession(connection, {
      user: safeUser,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await connection.commit();
    return sessionBundle;
  } catch (error) {
    await connection.rollback();

    if (error?.statusCode) {
      throw error;
    }

    throw serviceError(
      "Registration failed",
      500,
      "REGISTER_FAILED",
    );
  } finally {
    connection.release();
  }
};

const loginUser = async ({ email, password }, context = {}) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw serviceError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
       `SELECT id, email, role, is_active, password, failed_login_attempts, locked_until
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1`,
      [normalizedEmail],
    );

    if (userRows.length === 0) {
      throw serviceError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const user = userRows[0];

    if (Number(user.is_active) !== 1) {
      throw serviceError("Account is disabled", 403, "ACCOUNT_DISABLED");
    }

    if (isFutureDate(user.locked_until)) {
      throw serviceError(
        "Account temporarily locked due to multiple failed attempts",
        423,
        "ACCOUNT_LOCKED",
      );
    }

    const validPassword = await bcrypt.compare(password, user.password || "");

    if (!validPassword) {
      const currentAttempts = Number(user.failed_login_attempts || 0);
      const nextAttempts = currentAttempts + 1;

      if (nextAttempts >= LOGIN_MAX_ATTEMPTS) {
        await connection.execute(
          `UPDATE users
           SET failed_login_attempts = 0,
                locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
           WHERE id = ?`,
          [LOGIN_LOCK_MINUTES, user.id],
        );
      } else {
        await connection.execute(
          `UPDATE users
           SET failed_login_attempts = ?,
                locked_until = NULL
           WHERE id = ?`,
          [nextAttempts, user.id],
        );
      }

      await connection.commit();
      throw serviceError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    await connection.execute(
      `UPDATE users
       SET failed_login_attempts = 0,
            locked_until = NULL,
            last_login_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [user.id],
    );

    const safeUser = toSafeUser(user);

    const sessionBundle = await createInitialSession(connection, {
      user: safeUser,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await connection.commit();
    return sessionBundle;
  } catch (error) {
    await connection.rollback();

    if (error?.statusCode) {
      throw error;
    }

    throw serviceError("Login failed", 500, "LOGIN_FAILED");
  } finally {
    connection.release();
  }
};

const refreshSession = async ({ refreshToken }, context = {}) => {
  if (!refreshToken) {
    throw serviceError("Refresh token is required", 401, "REFRESH_TOKEN_MISSING");
  }

  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw serviceError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
  }

  if (!claims?.jti || !claims?.userId || !claims?.sessionId || !claims?.familyId) {
    throw serviceError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
  }

  const tokenHash = hashToken(refreshToken);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [tokenRows] = await connection.execute(
      `SELECT token_jti, user_id, session_id, family_id, token_hash, expires_at, used_at, replaced_by_jti, revoked_at
       FROM refresh_tokens
       WHERE token_jti = ?
       LIMIT 1`,
      [claims.jti],
    );

    if (tokenRows.length === 0) {
      await revokeRefreshFamily(
        connection,
        claims.familyId,
        "refresh-token-not-found",
      );
      await connection.commit();

      throw serviceError(
        "Session invalid. Please login again.",
        401,
        "REFRESH_REUSE_DETECTED",
      );
    }

    const tokenRow = tokenRows[0];
    const familyId = tokenRow.family_id || claims.familyId;

    if (!familyId) {
      throw serviceError("Invalid refresh token", 401, "REFRESH_TOKEN_INVALID");
    }

    const claimsMismatch =
      String(tokenRow.user_id) !== String(claims.userId) ||
      String(tokenRow.session_id) !== String(claims.sessionId) ||
      String(familyId) !== String(claims.familyId);

    const alreadyConsumed =
      Boolean(tokenRow.used_at) ||
      Boolean(tokenRow.replaced_by_jti) ||
      Boolean(tokenRow.revoked_at);

    const hashMismatch = String(tokenRow.token_hash) !== tokenHash;
    const expiresAtMs = Date.parse(tokenRow.expires_at);
    const expired = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();

    if (alreadyConsumed || claimsMismatch || hashMismatch) {
      // Reuse detection: a consumed/revoked/token-mismatched refresh token means
      // possible theft/replay. Revoke the entire family immediately.
      await revokeRefreshFamily(connection, familyId, "refresh-reuse-detected");
      await connection.commit();

      throw serviceError(
        "Session invalid. Please login again.",
        401,
        "REFRESH_REUSE_DETECTED",
      );
    }

    if (expired) {
      await revokeRefreshFamily(connection, familyId, "refresh-expired");
      await connection.commit();

      throw serviceError("Refresh token expired", 401, "REFRESH_TOKEN_EXPIRED");
    }

    const [sessionUserRows] = await connection.execute(
      `SELECT us.session_id, us.is_active, u.id, u.email, u.role, u.is_active AS user_active
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.session_id = ? AND us.user_id = ?
       LIMIT 1`,
      [tokenRow.session_id, tokenRow.user_id],
    );

    if (sessionUserRows.length === 0) {
      await revokeRefreshFamily(connection, familyId, "session-missing");
      await connection.commit();
      throw serviceError("Session not found", 401, "SESSION_NOT_FOUND");
    }

    const sessionUser = sessionUserRows[0];
    if (Number(sessionUser.is_active) !== 1 || Number(sessionUser.user_active) !== 1) {
      await revokeRefreshFamily(connection, familyId, "session-or-user-inactive");
      await connection.commit();
      throw serviceError("Session inactive", 401, "SESSION_INACTIVE");
    }

    const safeUser = toSafeUser(sessionUser);

    const rotated = await rotateRefreshToken(connection, {
      user: safeUser,
      sessionId: tokenRow.session_id,
      familyId,
      currentRefreshJti: tokenRow.token_jti,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await connection.commit();
    return rotated;
  } catch (error) {
    await connection.rollback();

    if (error?.statusCode) {
      throw error;
    }

    throw serviceError("Token refresh failed", 500, "REFRESH_FAILED");
  } finally {
    connection.release();
  }
};

const logoutSession = async ({ accessToken, refreshToken }) => {
  if (!accessToken && !refreshToken) {
    return { success: true };
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const familyIds = new Set();

    if (accessToken) {
      try {
        const accessClaims = verifyAccessToken(accessToken);

        await connection.execute(
          `INSERT INTO token_blacklist (jti, user_id, expires_at, reason)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             expires_at = VALUES(expires_at),
             reason = VALUES(reason)`,
          [
            accessClaims.jti,
            Number(accessClaims.userId),
            accessClaims.expiresAt,
            "logout",
          ],
        );

        await connection.execute(
          `UPDATE user_sessions
           SET is_active = 0,
               revoked_at = UTC_TIMESTAMP(),
               revoke_reason = 'logout'
           WHERE session_id = ?`,
          [accessClaims.sessionId],
        );
      } catch (_error) {
        // Ignore invalid/expired access token during logout.
      }
    }

    if (refreshToken) {
      try {
        const refreshClaims = verifyRefreshToken(refreshToken);

        if (refreshClaims.familyId) {
          familyIds.add(String(refreshClaims.familyId));
        }

        const [tokenRows] = await connection.execute(
          "SELECT family_id FROM refresh_tokens WHERE token_jti = ? LIMIT 1",
          [refreshClaims.jti],
        );

        if (tokenRows.length > 0 && tokenRows[0].family_id) {
          familyIds.add(String(tokenRows[0].family_id));
        }
      } catch (_error) {
        // Ignore invalid/expired refresh token during logout.
      }
    }

    for (const familyId of familyIds) {
      await revokeRefreshFamily(connection, familyId, "logout");
    }

    await connection.commit();

    return { success: true };
  } catch (error) {
    await connection.rollback();

    throw serviceError("Logout failed", 500, "LOGOUT_FAILED");
  } finally {
    connection.release();
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
  serviceError,
};
