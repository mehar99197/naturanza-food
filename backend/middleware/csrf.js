const crypto = require("crypto");

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");
const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const isStaticAssetPath = (path) => {
  if (!path) return false;
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".map"];
  return staticExtensions.some((ext) => path.toLowerCase().endsWith(ext));
};

const generateToken = () => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
};

const createSignedToken = (token, salt = "") => {
  const timestamp = Date.now().toString(36);
  const data = `${token}.${timestamp}.${salt}`;
  const hmac = crypto.createHmac("sha256", CSRF_SECRET);
  hmac.update(data);
  const signature = hmac.digest("base64url");
  return `${token}.${timestamp}.${signature}`;
};

const verifySignedToken = (signedToken, salt = "") => {
  try {
    const parts = signedToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid format" };
    }

    const [token, timestamp, signature] = parts;
    const tokenAge = Date.now() - parseInt(timestamp, 36);

    if (tokenAge > CSRF_COOKIE_MAX_AGE) {
      return { valid: false, reason: "Token expired" };
    }

    const data = `${token}.${timestamp}.${salt}`;
    const hmac = crypto.createHmac("sha256", CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, reason: "Invalid signature" };
    }

    return { valid: true, token, timestamp: parseInt(timestamp, 36) };
  } catch (error) {
    return { valid: false, reason: "Verification failed" };
  }
};

const csrfMiddleware = (options = {}) => {
  const {
    cookieSecure = process.env.NODE_ENV === "production",
    cookieSameSite = process.env.NODE_ENV === "production" ? "strict" : "lax",
    excludePaths = [],
  } = options;

  const excludedPaths = new Set(excludePaths);

  const shouldSkip = (req) => {
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    if (isStaticAssetPath(req.path)) {
      return true;
    }

    if (excludedPaths.has(req.path)) {
      return true;
    }

    if (req.path.startsWith("/images/") || req.path.startsWith("/uploads/")) {
      return true;
    }

    return false;
  };

  return (req, res, next) => {
    if (shouldSkip(req)) {
      return next();
    }

    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];

    if (!existingToken) {
      const newToken = generateToken();
      const signedToken = createSignedToken(newToken);

      res.cookie(CSRF_COOKIE_NAME, signedToken, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        maxAge: CSRF_COOKIE_MAX_AGE,
        path: "/",
      });

      req.csrfToken = newToken;
      return next();
    }

    const tokenFromBody = req.body?._csrf || req.body?.csrfToken;
    const tokenFromHeader = req.headers[CSRF_HEADER_NAME];
    const tokenFromQuery = req.query?._csrf;

    const clientToken = tokenFromBody || tokenFromHeader || tokenFromQuery;

    if (!clientToken) {
      return res.status(403).json({
        error: "CSRF token required",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    const verification = verifySignedToken(clientToken);

    if (!verification.valid) {
      return res.status(403).json({
        error: "Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    const existingVerification = verifySignedToken(existingToken);
    if (existingVerification.valid) {
      const newToken = generateToken();
      const signedToken = createSignedToken(newToken);

      res.cookie(CSRF_COOKIE_NAME, signedToken, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        maxAge: CSRF_COOKIE_MAX_AGE,
        path: "/",
      });

      req.csrfToken = newToken;
    }

    next();
  };
};

const getCsrfTokenForClient = (signedToken) => {
  const verification = verifySignedToken(signedToken);
  if (!verification.valid) {
    return null;
  }
  return verification.token;
};

module.exports = {
  csrfMiddleware,
  generateToken,
  createSignedToken,
  verifySignedToken,
  getCsrfTokenForClient,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_MAX_AGE,
};