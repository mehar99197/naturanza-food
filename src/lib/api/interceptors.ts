/**
 * The request interceptor: which bearer token goes on, and the CSRF header.
 *
 * Runs on every attempt, retries included — which is what the source did by
 * re-entering `axiosInstance(originalRequest)`, and why the explicit header
 * assignments in its error handler are redundant rather than load-bearing.
 */

import { CSRF_HEADER_NAME, SKIP_AUTH_REFRESH_HEADER } from "./config";
import { ensureCsrfToken } from "./csrf";
import { deleteHeader, readHeader } from "./http";
import {
  isAdminPage,
  isAdminRoute,
  isUserScopedRoute,
  shouldSkipCsrf,
} from "./routes";
import { getAdminAccessToken, getUserAccessToken } from "./session";
import type { AuthScope, RequestState } from "./types";

/**
 * Admin scope is resolved FIRST, then user scope fills in.
 *
 * `isUserScopedRoute` matches `/orders/*`, which also covers `/orders/admin/all`
 * and `/orders/:id/status` — checking it first meant an admin's request went out
 * with no Authorization header at all, working only because `authenticateToken`
 * falls back to the adminAccessToken cookie, and burning a wasted 401
 * round-trip on the reads that do get retried. An admin without a user session
 * is the normal case.
 */
export const applyAuthHeader = (state: RequestState): void => {
  const adminToken = getAdminAccessToken();
  const userToken = getUserAccessToken();
  const requestUrl = String(state.url || "");

  let token: string | null = null;
  let authScope: AuthScope = "none";

  if (isAdminRoute(requestUrl) || isAdminPage()) {
    token = adminToken || null;
    authScope = token ? "admin" : "none";
  }

  if (!token && isUserScopedRoute(requestUrl)) {
    token = userToken || null;
    authScope = token ? "user" : "none";
  }

  state.authScope = authScope;

  if (token) {
    state.headers.Authorization = `Bearer ${token}`;
  } else {
    deleteHeader(state.headers, "Authorization");
  }
};

/**
 * Attaches the double-submit CSRF token on unsafe methods.
 *
 * A failure to obtain one is swallowed on purpose: the request still goes out,
 * the server answers 403 with `CSRF_TOKEN_MISSING`, and the response handler
 * retries once with a fresh token. Failing here instead would turn a recoverable
 * hiccup into a dead form.
 */
export const applyCsrfHeader = async (state: RequestState): Promise<void> => {
  if (shouldSkipCsrf(state.method, String(state.url || ""))) {
    return;
  }

  try {
    const resolvedCsrfToken = await ensureCsrfToken();
    if (resolvedCsrfToken) {
      state.headers[CSRF_HEADER_NAME] = resolvedCsrfToken;
    }
  } catch {
    // Allow request to proceed without CSRF header if token fetch fails.
  }
};

export const applyRequestInterceptor = async (
  state: RequestState,
): Promise<RequestState> => {
  applyAuthHeader(state);
  await applyCsrfHeader(state);
  return state;
};

/**
 * True when the caller opted out of the silent refresh.
 *
 * Used by `/auth/logout` (a refresh there would resurrect the session it is
 * tearing down) and by the invoice download (a 120s PDF request must not be
 * replayed). Matched case-insensitively against the literal string "true".
 */
export const shouldSkipAuthRefresh = (state: RequestState): boolean => {
  const skipHeader = readHeader(state.headers, SKIP_AUTH_REFRESH_HEADER);
  return String(skipHeader || "").toLowerCase() === "true";
};
