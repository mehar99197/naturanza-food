/**
 * CSRF token cache.
 *
 * `backend/middleware/csrf.js` runs a double-submit check: it plants a signed
 * token in an HttpOnly `csrf_token` cookie and requires the unsigned half back
 * on every unsafe request. `GET /api/csrf-token` is what hands that half over.
 *
 * The fetch deliberately bypasses the interceptor pipeline — the source used a
 * second, bare axios instance (`csrfAxios`) for exactly this reason. Going
 * through the normal client would mean the CSRF interceptor calling itself, and
 * would put an Authorization header on a request that must not need one.
 */

import { performRequest } from "./http";
import { isRecord } from "./errors";
import type { CsrfTokenResponse, RequestState } from "./types";

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

const CSRF_REQUEST: RequestState = {
  url: "/csrf-token",
  method: "GET",
  headers: {},
  authScope: "none",
  retry: false,
  refreshRetry: false,
  csrfRetry: false,
};

const readToken = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const { csrfToken: token } = payload as CsrfTokenResponse;
  return token ? String(token) : null;
};

const fetchCsrfToken = async (): Promise<string | null> => {
  const response = await performRequest({ ...CSRF_REQUEST, headers: {} });
  const nextToken = readToken(response.data);
  if (nextToken) {
    csrfToken = String(nextToken);
  }
  // Returns the cached value, not `nextToken` — a response without a token
  // leaves whatever was already cached in place.
  return csrfToken;
};

/**
 * Resolves the cached token, fetching one if needed. Concurrent callers share a
 * single in-flight request so a burst of writes does not mint a burst of
 * tokens — each new token would rotate the cookie and invalidate the last.
 */
export const ensureCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }

  return csrfTokenPromise;
};

/** Drops the cache so the next unsafe request refetches. */
export const resetCsrfToken = (): void => {
  csrfToken = null;
};

export const getCachedCsrfToken = (): string | null => csrfToken;
