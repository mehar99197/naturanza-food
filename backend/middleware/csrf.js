const crypto = require("crypto");

/**
 * Stateless double-submit CSRF protection.
 *
 * The server issues an HMAC-signed token, stores it in an httpOnly cookie, and
 * returns the same value from GET /api/csrf-token. Every unsafe request must
 * echo it back in the `x-csrf-token` header (or `_csrf` body/query field), and
 * the two must MATCH — a valid signature alone is not enough, because any token
 * this server ever signed would otherwise be accepted for any browser.
 */

const NODE_ENV = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";

// A per-process random secret invalidates every outstanding token on restart and
// makes tokens unverifiable across a PM2 cluster / multiple instances. Prefer an
// explicit CSRF_SECRET; otherwise derive a stable one from JWT_SECRET so the
// value is at least identical across restarts and workers.
const resolveCsrfSecret = () => {
  const explicit = String(process.env.CSRF_SECRET || "").trim();
  if (explicit) {
    return explicit;
  }

  const jwtSecret = String(
    process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "",
  ).trim();

  if (jwtSecret) {
    console.warn(
      "CSRF_SECRET is not set; deriving it from JWT_SECRET. Set CSRF_SECRET explicitly.",
    );
    return crypto
      .createHmac("sha256", jwtSecret)
      .update("naturanza:csrf-secret:v1")
      .digest("hex");
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "CSRF_SECRET (or JWT_SECRET) must be configured in production — a random per-process secret breaks CSRF tokens on every restart.",
    );
  }

  console.warn(
    "CSRF_SECRET is not set and no JWT_SECRET is available; using a random development secret. Tokens will not survive a restart.",
  );
  return crypto.randomBytes(32).toString("hex");
};

const CSRF_SECRET = resolveCsrfSecret();
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

// Length-safe constant-time comparison — crypto.timingSafeEqual throws when the
// buffers differ in length, which would otherwise leak through as a generic error.
const safeCompare = (a, b) => {
  const bufferA = Buffer.from(String(a || ""), "utf8");
  const bufferB = Buffer.from(String(b || ""), "utf8");

  if (bufferA.length !== bufferB.length || bufferA.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const verifySignedToken = (signedToken, salt = "") => {
  try {
    const parts = String(signedToken || "").split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid format" };
    }

    const [token, timestamp, signature] = parts;
    const issuedAt = parseInt(timestamp, 36);

    if (!Number.isFinite(issuedAt)) {
      return { valid: false, reason: "Invalid timestamp" };
    }

    if (Date.now() - issuedAt > CSRF_COOKIE_MAX_AGE) {
      return { valid: false, reason: "Token expired" };
    }

    const data = `${token}.${timestamp}.${salt}`;
    const hmac = crypto.createHmac("sha256", CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest("base64url");

    if (!safeCompare(signature, expectedSignature)) {
      return { valid: false, reason: "Invalid signature" };
    }

    return { valid: true, token, timestamp: issuedAt };
  } catch (error) {
    return { valid: false, reason: "Verification failed" };
  }
};

const buildCookieOptions = (cookieSecure, cookieSameSite) => ({
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: CSRF_COOKIE_MAX_AGE,
  path: "/",
});

const csrfMiddleware = (options = {}) => {
  const {
    cookieSecure = IS_PRODUCTION,
    cookieSameSite = IS_PRODUCTION ? "strict" : "lax",
  } = options;

  const shouldSkip = (req) => {
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    if (isStaticAssetPath(req.path)) {
      return true;
    }

    // Uploaded media is read-only; there is nothing to protect on these paths.
    if (req.path.startsWith("/images/") || req.path.startsWith("/uploads/")) {
      return true;
    }

    return false;
  };

  return (req, res, next) => {
    if (shouldSkip(req)) {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    // A missing cookie previously fell through to next(), which disabled CSRF
    // for the request entirely. With SameSite=strict the cookie is never sent
    // on a cross-site request, so that branch was the always-taken path for
    // exactly the traffic this middleware exists to stop. Reject instead — the
    // API client refetches a token and retries once on CSRF_TOKEN_MISSING.
    if (!cookieToken) {
      return res.status(403).json({
        error: "CSRF token required",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    // Accept the token ONLY from the custom request header. A cross-site HTML form
    // can set body/query fields but cannot set a custom header, so header-only
    // acceptance removes the form-submission CSRF vector that body/`_csrf` support
    // reintroduced. The SPA already sends it as `x-csrf-token` (services/api.js).
    const clientToken = req.headers[CSRF_HEADER_NAME];

    if (!clientToken) {
      return res.status(403).json({
        error: "CSRF token required",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    const cookieVerification = verifySignedToken(cookieToken);
    const clientVerification = verifySignedToken(String(clientToken));

    if (!cookieVerification.valid || !clientVerification.valid) {
      return res.status(403).json({
        error: "Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    // The double-submit check: the submitted token must be the one bound to
    // THIS browser's cookie, not merely a well-signed token.
    if (!safeCompare(clientVerification.token, cookieVerification.token)) {
      return res.status(403).json({
        error: "Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    // Deliberately no per-request rotation: the client is never told about a
    // rotated value, so rotating would invalidate the token it still holds and
    // force a failed request + refetch on every single mutation.
    return next();
  };
};

const issueCsrfCookie = (res, { cookieSecure = IS_PRODUCTION, cookieSameSite = IS_PRODUCTION ? "strict" : "lax" } = {}) => {
  const signedToken = createSignedToken(generateToken());
  res.cookie(CSRF_COOKIE_NAME, signedToken, buildCookieOptions(cookieSecure, cookieSameSite));
  return signedToken;
};

module.exports = {
  csrfMiddleware,
  generateToken,
  createSignedToken,
  verifySignedToken,
  issueCsrfCookie,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_MAX_AGE,
};
