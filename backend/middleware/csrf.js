const crypto = require("crypto");
const {
  getCookieDomain,
  shouldUseSecureCookies,
  resolveSameSite,
} = require("../utils/jwtTokens");

const configuredCsrfSecret = String(process.env.CSRF_SECRET || "").trim();
const jwtSecret = String(process.env.JWT_SECRET || "").trim();
const CSRF_SECRET = configuredCsrfSecret ||
  (jwtSecret
    ? crypto
        .createHash("sha256")
        .update(`naturanza-csrf:${jwtSecret}`, "utf8")
        .digest("hex")
    : crypto.randomBytes(32).toString("hex"));
const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
    if (typeof signedToken !== "string") {
      return { valid: false, reason: "Invalid format" };
    }
    const parts = signedToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid format" };
    }

    const [token, timestamp, signature] = parts;
    const parsedTimestamp = parseInt(timestamp, 36);
    const tokenAge = Date.now() - parsedTimestamp;

    if (!Number.isFinite(parsedTimestamp) || tokenAge < -60_000 || tokenAge > CSRF_COOKIE_MAX_AGE) {
      return { valid: false, reason: "Token expired" };
    }

    const data = `${token}.${timestamp}.${salt}`;
    const hmac = crypto.createHmac("sha256", CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, reason: "Invalid signature" };
    }

    return { valid: true, token, timestamp: parsedTimestamp };
  } catch (error) {
    return { valid: false, reason: "Verification failed" };
  }
};

// NOTE: there is deliberately no path-only skip list here. SAFE_METHODS
// already skips every GET/HEAD/OPTIONS request, so skipping by file extension
// or prefix only exempted unsafe methods (e.g., DELETE /api/admin/users/5.js).
// The sole narrow method+path exemption is RFC 8058 one-click newsletter
// unsubscribe, which mail clients POST directly using an unguessable 64-hex token.
const ONE_CLICK_UNSUBSCRIBE_RE = /^\/api\/newsletter\/unsubscribe\/[A-Za-z0-9_-]{16,128}$/;

const csrfMiddleware = (options = {}) => {
  const {
    cookieSecure = shouldUseSecureCookies(),
    cookieSameSite = resolveSameSite(),
  } = options;

  const shouldSkip = (req) => {
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    if (req.method === "POST" && ONE_CLICK_UNSUBSCRIBE_RE.test(String(req.path || ""))) {
      return true;
    }

    return false;
  };

  return (req, res, next) => {
    if (shouldSkip(req)) {
      return next();
    }

    let existingToken = req.cookies?.[CSRF_COOKIE_NAME];

    if (!existingToken) {
      const newToken = generateToken();
      const signedToken = createSignedToken(newToken);
      const cookieDomain = getCookieDomain(req);

      res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
      if (cookieDomain) {
        res.clearCookie(CSRF_COOKIE_NAME, {
          path: "/",
          domain: cookieDomain,
          maxAge: 0,
        });
      }
      res.cookie(CSRF_COOKIE_NAME, signedToken, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        maxAge: CSRF_COOKIE_MAX_AGE,
        path: "/",
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      });

      existingToken = signedToken;
    }

    const tokenFromHeader = req.headers[CSRF_HEADER_NAME];
    const tokenFromBody = req.body?._csrf || req.body?.csrfToken;

    // Never accept CSRF tokens from URL query strings — query parameters leak
    // into server access logs, browser history, and Referer headers.
    const clientToken = tokenFromHeader || tokenFromBody;

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
    if (!existingVerification.valid || existingVerification.token !== verification.token) {
      return res.status(403).json({
        error: "Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    req.csrfToken = verification.token;
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
