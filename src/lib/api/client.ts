/**
 * The request pipeline and the public client surface.
 *
 * Order of business on every attempt, matching the source exactly:
 *   1. request interceptor — bearer token, then CSRF header;
 *   2. transport;
 *   3. on failure, the transport-error decorator (registered first in the
 *      source, so it annotates before anything can branch on the result);
 *   4. the auth/CSRF error handler, which may mutate the request and re-enter
 *      at step 1 — the retry flags on `RequestState` are what stop it looping.
 */

import { CSRF_HEADER_NAME } from "./config";
import { ensureCsrfToken, resetCsrfToken } from "./csrf";
import {
  ApiError,
  decorateTransportError,
  errorCodeOf,
  isRecord,
  withCsrfUserMessage,
} from "./errors";
import { performRequest } from "./http";
import { applyRequestInterceptor, shouldSkipAuthRefresh } from "./interceptors";
import { withCrossTabRefreshLock } from "./refresh-lock";
import { isAdminEndpoint, isAuthEndpoint, isUserRoute } from "./routes";
import {
  clearAdminAccessToken,
  clearUserAccessToken,
  emitAuthSessionSync,
  getAdminAccessToken,
  getUserAuthGeneration,
  setUserAccessToken,
} from "./session";
import type {
  ApiResponse,
  RequestBody,
  RequestConfig,
  RequestOptions,
  RequestState,
} from "./types";

const createState = (config: RequestConfig): RequestState => ({
  ...config,
  method: config.method ?? "GET",
  headers: { ...(config.headers ?? {}) },
  authScope: "none",
  retry: false,
  refreshRetry: false,
  csrfRetry: false,
});

const toApiError = (raw: unknown, state: RequestState): ApiError => {
  if (raw instanceof ApiError) return raw;
  const message = raw instanceof Error ? raw.message : String(raw);
  return new ApiError(message, { config: state });
};

const request = async (state: RequestState): Promise<ApiResponse<unknown>> => {
  await applyRequestInterceptor(state);
  try {
    return await performRequest(state);
  } catch (raw) {
    const error = decorateTransportError(toApiError(raw, state));
    return handleResponseError(error, state);
  }
};

/**
 * The response error interceptor. Never resolves with a value of its own — it
 * either resolves with a *retried* response or rethrows.
 */
async function handleResponseError(
  error: ApiError,
  state: RequestState,
): Promise<ApiResponse<unknown>> {
  const status = Number(error.response?.status ?? 0);
  const requestUrl = String(state.url || "");
  const csrfCode = errorCodeOf(error);
  const isCsrfError =
    status === 403 &&
    (csrfCode === "CSRF_TOKEN_MISSING" || csrfCode === "CSRF_TOKEN_INVALID");

  if (isCsrfError && !state.csrfRetry) {
    state.csrfRetry = true;
    resetCsrfToken();

    let refreshedToken: string | null;
    try {
      refreshedToken = await ensureCsrfToken();
    } catch {
      throw withCsrfUserMessage(error);
    }
    if (refreshedToken) {
      state.headers[CSRF_HEADER_NAME] = refreshedToken;
    }
    return request(state);
  }

  if (isCsrfError) {
    // The refetch already ran and the token was still rejected. Callers render
    // the server wording verbatim, and "CSRF token required" tells a visitor
    // nothing about what to do next.
    throw withCsrfUserMessage(error);
  }

  // Don't retry auth endpoints (login, register, etc.)
  if (isAuthEndpoint(requestUrl)) {
    throw error;
  }

  // For admin endpoints - retry with admin token on 401
  if (status === 401 && isAdminEndpoint(requestUrl)) {
    const adminToken = getAdminAccessToken();
    if (adminToken && !state.retry) {
      state.retry = true;
      state.headers.Authorization = `Bearer ${adminToken}`;
      return request(state);
    }
    clearAdminAccessToken();
    emitAuthSessionSync("admin-token-invalid");
    throw error;
  }

  // For user routes - auto-refresh token on 401/403 if not already retried
  if (
    (status === 401 || status === 403) &&
    isUserRoute(requestUrl) &&
    !state.retry &&
    !state.refreshRetry &&
    !shouldSkipAuthRefresh(state)
  ) {
    state.refreshRetry = true;

    let refreshedToken: string | null;
    try {
      refreshedToken = await refreshUserAccessToken();
    } catch {
      // Refresh failed - clear user session
      clearUserAccessToken();
      emitAuthSessionSync("user-token-refresh-failed");
      throw error;
    }

    if (refreshedToken) {
      state.headers.Authorization = `Bearer ${refreshedToken}`;
      return request(state);
    }
    clearUserAccessToken();
    emitAuthSessionSync("user-token-refresh-failed");
  }

  if (status === 401 && state.authScope === "admin") {
    clearAdminAccessToken();
    emitAuthSessionSync("admin-token-invalid");
  }

  throw error;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchanges the HttpOnly refresh cookie for a new access token, at most once
 * concurrently per tab and once across tabs.
 *
 * `X-Skip-Auth-Refresh` on the call is the loop guard: without it a 401 from
 * `/auth/refresh` would trigger another refresh. The generation check discards
 * a token that arrives after the user has logged out.
 */
export const refreshUserAccessToken = (): Promise<string | null> => {
  const generation = getUserAuthGeneration();
  if (!refreshPromise) {
    refreshPromise = withCrossTabRefreshLock(() =>
      request(
        createState({
          url: "/auth/refresh",
          method: "POST",
          data: {},
          headers: { "X-Skip-Auth-Refresh": "true" },
        }),
      ),
    )
      .then((response) => {
        const payload = response.data;
        const nextToken = isRecord(payload)
          ? payload.accessToken || payload.token
          : null;
        if (!nextToken || generation !== getUserAuthGeneration()) {
          return null;
        }
        const token = String(nextToken);
        setUserAccessToken(token);
        emitAuthSessionSync("user-token-refresh");
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const send = async <T>(config: RequestConfig): Promise<ApiResponse<T>> => {
  const response = await request(createState(config));
  return response as ApiResponse<T>;
};

/**
 * The single entry point every resource module goes through.
 *
 * `request` hands back the whole response (needed where status or headers
 * matter, e.g. the invoice download); the verb helpers hand back `data`
 * directly, which is what every call site in the source actually used.
 */
export const apiClient = {
  request: <T = unknown>(config: RequestConfig): Promise<ApiResponse<T>> =>
    send<T>(config),

  get: <T = unknown>(url: string, options: RequestOptions = {}): Promise<T> =>
    send<T>({ ...options, url, method: "GET" }).then((r) => r.data),

  post: <T = unknown>(
    url: string,
    data?: RequestBody,
    options: RequestOptions = {},
  ): Promise<T> =>
    send<T>({ ...options, url, method: "POST", data }).then((r) => r.data),

  put: <T = unknown>(
    url: string,
    data?: RequestBody,
    options: RequestOptions = {},
  ): Promise<T> =>
    send<T>({ ...options, url, method: "PUT", data }).then((r) => r.data),

  patch: <T = unknown>(
    url: string,
    data?: RequestBody,
    options: RequestOptions = {},
  ): Promise<T> =>
    send<T>({ ...options, url, method: "PATCH", data }).then((r) => r.data),

  delete: <T = unknown>(url: string, options: RequestOptions = {}): Promise<T> =>
    send<T>({ ...options, url, method: "DELETE" }).then((r) => r.data),
} as const;
