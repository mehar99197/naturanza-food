export const SESSION_HINT_COOKIE_NAME = "naturanza_session";

/**
 * Checks whether the lightweight, non-HttpOnly session presence hint cookie is
 * set. The cookie carries only the constant value "1" (no secrets or user data)
 * and is set/cleared by the backend in lockstep with the HttpOnly refreshToken
 * cookie so logged-out guests skip unnecessary /api/auth/refresh 401 requests.
 */
export const hasSessionHintCookie = (
  cookieString = typeof document !== "undefined" ? document.cookie : "",
) =>
  String(cookieString || "")
    .split(";")
    .some((entry) => {
      const eqIdx = entry.indexOf("=");
      if (eqIdx === -1) return false;
      const name = entry.slice(0, eqIdx).trim();
      const value = entry.slice(eqIdx + 1).trim();
      return name === SESSION_HINT_COOKIE_NAME && value === "1";
    });

/**
 * Determines whether AuthContext should attempt a silent /api/auth/refresh on
 * page load. Existing logged-in users migrating from before the hint cookie
 * existed still have cached userData in localStorage, while fresh sessions
 * across tabs/subdomains carry the hint cookie. Logged-out guests have neither.
 */
export const shouldAttemptSilentRefresh = ({
  hasAccessToken = false,
  hasActiveSession = false,
  cachedUser = null,
  cookieString,
} = {}) => {
  if (hasAccessToken && hasActiveSession) {
    return false;
  }
  return Boolean(cachedUser) || hasSessionHintCookie(cookieString);
};

/**
 * Defense-in-depth client-side expiry for the non-HttpOnly session hint cookie
 * (used when logout completes or falls back offline so a stale hint cannot
 * trigger unnecessary /api/auth/refresh 401 requests on the next reload).
 */
export const clearSessionHintCookie = () => {
  if (typeof document === "undefined") {
    return;
  }

  const baseAttrs = `${SESSION_HINT_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
  document.cookie = baseAttrs;

  const hostname =
    typeof window !== "undefined"
      ? String(window.location?.hostname || "").trim().toLowerCase()
      : "";
  if (hostname === "naturanzafood.com" || hostname.endsWith(".naturanzafood.com")) {
    document.cookie = `${baseAttrs}; Domain=.naturanzafood.com`;
  }
};
