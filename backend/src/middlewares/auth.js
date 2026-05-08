const { pool } = require("../config/db");
const { verifyAccessToken } = require("../security/jwt");

const authError = (
  message,
  statusCode = 401,
  code = "AUTHENTICATION_REQUIRED",
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const protect = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return next(authError("Access token is required", 401, "ACCESS_TOKEN_MISSING"));
  }

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (_error) {
    return next(authError("Invalid or expired access token", 401, "ACCESS_TOKEN_INVALID"));
  }

  if (!claims?.jti || !claims?.userId || !claims?.sessionId) {
    return next(authError("Invalid access token", 401, "ACCESS_TOKEN_INVALID"));
  }

  try {
    const [blacklistRows] = await pool.execute(
      "SELECT jti FROM token_blacklist WHERE jti = ? LIMIT 1",
      [claims.jti],
    );

    if (blacklistRows.length > 0) {
      return next(authError("Session revoked. Please login again.", 401, "TOKEN_REVOKED"));
    }

    const [sessionRows] = await pool.execute(
      `SELECT is_active
       FROM user_sessions
       WHERE session_id = ? AND user_id = ?
       LIMIT 1`,
      [claims.sessionId, claims.userId],
    );

    if (sessionRows.length === 0 || Number(sessionRows[0].is_active) !== 1) {
      return next(authError("Session inactive. Please login again.", 401, "SESSION_INACTIVE"));
    }

    const [userRows] = await pool.execute(
      "SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1",
      [claims.userId],
    );

    if (userRows.length === 0) {
      return next(authError("User account not found", 401, "USER_NOT_FOUND"));
    }

    if (Number(userRows[0].is_active) !== 1) {
      return next(authError("Account is disabled", 403, "ACCOUNT_DISABLED"));
    }

    req.user = {
      id: Number(userRows[0].id),
      email: String(userRows[0].email),
      role: String(userRows[0].role || "customer"),
      sessionId: String(claims.sessionId),
      jti: String(claims.jti),
    };
    req.token = token;

    return next();
  } catch (_error) {
    return next(
      authError(
        "Authentication service unavailable",
        503,
        "AUTH_SERVICE_UNAVAILABLE",
      ),
    );
  }
};

module.exports = {
  protect,
};
