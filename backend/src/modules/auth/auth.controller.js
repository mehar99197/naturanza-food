const { env } = require("../../config/env");
const {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
  serviceError,
} = require("./auth.service");
const {
  getRefreshCookieOptions,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} = require("../../../utils/jwtTokens");

const getRequestIp = (req) => {
  const xff = req.headers["x-forwarded-for"];
  if (xff && String(xff).includes(",")) {
    return String(xff).split(",")[0].trim();
  }

  if (xff) {
    return String(xff).trim();
  }

  return String(req.ip || req.socket?.remoteAddress || "").slice(0, 45);
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;

  return token.trim();
};

const register = async (req, res, next) => {
  try {
    const payload = req.validatedBody || req.body || {};

    const result = await registerUser(payload, {
      ipAddress: getRequestIp(req),
      userAgent: req.get("user-agent") || null,
      requestId: req.id || null,
    });

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.tokens.refreshToken,
      getRefreshCookieOptions(),
    );

    return res.status(201).json({
      message: "Registration successful",
      accessToken: result.tokens.accessToken,
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const payload = req.validatedBody || req.body || {};

    const result = await loginUser(payload, {
      ipAddress: getRequestIp(req),
      userAgent: req.get("user-agent") || null,
      requestId: req.id || null,
    });

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.tokens.refreshToken,
      getRefreshCookieOptions(),
    );

    return res.status(200).json({
      message: "Login successful",
      accessToken: result.tokens.accessToken,
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!currentRefreshToken) {
      throw serviceError("Refresh token is required", 401, "REFRESH_TOKEN_MISSING");
    }

    const result = await refreshSession(
      { refreshToken: currentRefreshToken },
      {
        ipAddress: getRequestIp(req),
        userAgent: req.get("user-agent") || null,
        requestId: req.id || null,
      },
    );

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.tokens.refreshToken,
      getRefreshCookieOptions(),
    );

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken: result.tokens.accessToken,
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const accessToken = getBearerToken(req);
    const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || null;

    await logoutSession({
      accessToken,
      refreshToken: currentRefreshToken,
    });

    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshCookieOptions(),
      maxAge: 0,
    });

    return res.status(200).json({
      message: "Logged out successfully",
      success: true,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
};
