/**
 * Content Security Policy, with per-request nonce support for Next.js.
 *
 * WHY THIS EXISTS
 *
 * The policy deliberately does NOT allow 'unsafe-inline' in script-src. That is
 * the directive doing the real anti-XSS work, and it predates this migration.
 *
 * Next.js App Router streams the server-rendered payload to the browser inside
 * inline <script> tags (`self.__next_f.push(...)`). Under the policy above the
 * browser blocks every one of them, so React receives no payload, hydration is
 * aborted (React error #412) and the page falls back to client rendering: the
 * markup is there but the application is not wired up.
 *
 * The fix is a nonce rather than 'unsafe-inline'. Next reads the nonce from the
 * INCOMING REQUEST's Content-Security-Policy header and stamps it on the inline
 * scripts it emits — see next/dist/server/app-render/app-render.js:
 *
 *     const csp = headers['content-security-policy'] || headers['content-security-policy-report-only'];
 *     const nonce = typeof csp === 'string' ? getScriptNonceFromHeader(csp) : undefined;
 *
 * So Express generates a nonce per request, puts the policy carrying it on the
 * request (for Next to read) and on the response (for the browser to enforce).
 * Both must be the same value or the browser blocks what Next just signed.
 *
 * CONSEQUENCE — this is the cost, stated plainly: a nonce is per request, so a
 * page whose HTML was generated once at build time would carry a stale nonce
 * that matches no future response. Every Next route that ships inline scripts
 * must therefore be rendered per request. That is enforced in one place, by
 * `export const dynamic = "force-dynamic"` in the storefront layout, which
 * applies to every route nested under it.
 *
 * The alternative — adding 'unsafe-inline' to script-src — would have kept
 * static generation at the price of the policy's main protection on a site that
 * takes card details and runs an admin panel. It was not a close call.
 */

const crypto = require("crypto");

/**
 * The policy, as directive -> sources.
 *
 * script-src omits the nonce here; `buildCspHeader` splices it in per request.
 */
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "script-src": [
    "'self'",
    "https://accounts.google.com",
    "https://apis.google.com",
    "https://www.googletagmanager.com",
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com",
  ],
  "style-src-attr": ["'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": [
    "'self'",
    "https://accounts.google.com",
    "https://apis.google.com",
    "https://www.google-analytics.com",
  ],
  "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
  "media-src": ["'self'"],
  "frame-src": [
    "'self'",
    "https://accounts.google.com",
    "https://www.openstreetmap.org",
  ],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
};

/** Directives that take no value. */
const CSP_FLAGS = ["upgrade-insecure-requests"];

/**
 * A fresh nonce. 16 random bytes, base64 — the length CSP implementations
 * expect, and generated per request so it cannot be replayed.
 */
const createNonce = () => crypto.randomBytes(16).toString("base64");

/**
 * The policy as a header string. With a nonce, `'nonce-<value>'` is added to
 * script-src only; styles already allow inline and adding it there would be
 * noise.
 */
const buildCspHeader = (nonce) => {
  const parts = Object.entries(CSP_DIRECTIVES).map(([directive, sources]) => {
    const values =
      directive === "script-src" && nonce
        ? [...sources, `'nonce-${nonce}'`]
        : sources;
    return `${directive} ${values.join(" ")}`;
  });

  return [...parts, ...CSP_FLAGS].join("; ");
};

/**
 * Express middleware: mint a nonce, hand the policy to Next on the request and
 * to the browser on the response.
 *
 * Setting it on `req.headers` is what makes Next emit `nonce="..."` on its
 * inline scripts. Setting it on the response is what makes the browser accept
 * them. The nonce is also exposed on `res.locals` so any server-rendered markup
 * Express itself emits can use it.
 *
 * `enabled` mirrors the previous behaviour, where the full policy was attached
 * only on production responses. When it is false nothing is set and the helmet
 * defaults stand, exactly as before.
 */
const createCspMiddleware = ({ enabled }) =>
  function applyContentSecurityPolicy(req, res, next) {
    if (!enabled) {
      return next();
    }

    const nonce = createNonce();
    const policy = buildCspHeader(nonce);

    res.locals.cspNonce = nonce;
    // Read by Next when it renders; ignored by every Express route.
    req.headers["content-security-policy"] = policy;
    res.setHeader("Content-Security-Policy", policy);

    return next();
  };

module.exports = {
  CSP_DIRECTIVES,
  buildCspHeader,
  createNonce,
  createCspMiddleware,
};
