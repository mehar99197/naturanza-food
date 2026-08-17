/**
 * The URL predicates the interceptors branch on.
 *
 * These are copied character-for-character from the source. They look
 * redundant and overlapping in places — `isAdminRoute` tests four expressions
 * that mostly imply one another, `isUserScopedRoute` claims `/orders/admin/all`
 * — but the exact overlap is what decides which bearer token each of 200-odd
 * endpoints goes out with, so it is preserved rather than tidied.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * `backend/middleware/csrf.js` skips GET/HEAD/OPTIONS itself, so sending the
 * header on them would be inert; `/csrf-token` is excluded to avoid a cycle and
 * `/health` because it is the liveness probe.
 */
export const shouldSkipCsrf = (method: string, url: string): boolean => {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }
  if (url.includes("/health") || url.includes("/csrf-token")) {
    return true;
  }
  return false;
};

/**
 * Routes that carry the *user* access token.
 *
 * Note this also matches `/orders/admin/all` and `/orders/:id/status`, which
 * are admin endpoints. That overlap is why the interceptor resolves admin scope
 * first — see `applyAuthHeader`.
 */
export const isUserScopedRoute = (url: string): boolean =>
  /^\/auth(\/|$)/.test(url) ||
  /^\/profile(\/|$)/.test(url) ||
  /^\/wishlist(\/|$)/.test(url) ||
  /^\/cart(\/|$)/.test(url) ||
  /^\/orders(\/|$)/.test(url) ||
  /^\/reviews(\/|$)/.test(url) ||
  /^\/payments(\/|$)/.test(url);

/**
 * Routes that carry the *admin* access token. `includes("/admin")` is the
 * broadest of the four tests and subsumes the rest; it also catches
 * `/admin-management/*`. Kept whole because narrowing it would change which
 * requests get an Authorization header.
 */
export const isAdminRoute = (url: string): boolean =>
  url.includes("/admin") ||
  url.includes("/admin-") ||
  /^\/admin(\/|$)/.test(url) ||
  /\/admin(\/|$)/.test(url);

/**
 * True while the browser is on an admin screen. This is what lets admin-only
 * calls to endpoints with no `/admin` in the path (for example `/coupons`, or
 * `/products` writes) pick up the admin token.
 */
export const isAdminPage = (): boolean =>
  typeof window !== "undefined" &&
  /^\/admin(\/|$)/.test(String(window.location?.pathname || ""));

/** Endpoints whose 401 triggers the admin retry rather than the user refresh. */
export const isAdminEndpoint = (url: string): boolean =>
  url.includes("/admin-management") || url.includes("/admin/");

/**
 * Login, register, refresh and friends. A 401 here is the answer, not a stale
 * token, so it must never trigger a refresh-and-retry.
 */
export const isAuthEndpoint = (url: string): boolean =>
  /^\/auth(\/|$)/.test(url) || url.includes("/auth/");

/**
 * Routes eligible for the silent access-token refresh. Identical to
 * {@link isUserScopedRoute}; the source declares it twice and both copies are
 * kept so the two concerns stay independently editable.
 */
export const isUserRoute = (url: string): boolean =>
  /^\/auth(\/|$)/.test(url) ||
  /^\/profile(\/|$)/.test(url) ||
  /^\/wishlist(\/|$)/.test(url) ||
  /^\/cart(\/|$)/.test(url) ||
  /^\/orders(\/|$)/.test(url) ||
  /^\/reviews(\/|$)/.test(url) ||
  /^\/payments(\/|$)/.test(url);
