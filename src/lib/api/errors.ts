/**
 * The error surface callers see.
 *
 * Call sites across the app read `error.response.status`, `error.response.data`,
 * `error.code` and the `customMessage` the interceptors attach, so `ApiError`
 * keeps exactly those fields under exactly those names. Anything that changed
 * them would compile and then quietly degrade every error message in the UI.
 */

import type { RequestState, ResponseHeaders } from "./types";

export interface ApiErrorResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: ResponseHeaders;
  data: T;
}

export class ApiError<T = unknown> extends Error {
  /** Present for any response that reached us, absent for a network failure. */
  response?: ApiErrorResponse<T>;

  /** `"ECONNABORTED"` on timeout, mirroring axios. */
  code?: string;

  /** The request as it was finally sent, retry flags included. */
  config?: RequestState;

  /** Set by the transport error decorator when the request timed out. */
  isTimeout?: boolean;

  /** Set by the transport error decorator when no response arrived at all. */
  isNetworkError?: boolean;

  /** User-facing wording the interceptors substitute for raw server text. */
  customMessage?: string;

  /**
   * A bare HTTP status for errors this client raises before sending anything —
   * `orderAPI.create` throws a 401 locally when there is no session. Kept as a
   * distinct field because there is no `response` to hang it off.
   */
  status?: number;

  constructor(message: string, init: Partial<ApiError<T>> = {}) {
    super(message);
    this.name = "ApiError";
    Object.assign(this, init);
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

/** Narrows an unknown payload to something whose properties can be read. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads the `code` discriminator Express puts on its error envelopes. */
export const errorCodeOf = (error: unknown): string => {
  if (!isApiError(error) || !isRecord(error.response?.data)) {
    return "";
  }
  return String(error.response.data.code ?? "").toUpperCase();
};

export const statusOf = (error: unknown): number =>
  isApiError(error) ? Number(error.response?.status ?? 0) : 0;

export const CSRF_USER_MESSAGE =
  "Your security session expired. Please refresh the page and try again.";

/**
 * Overwrites the server's CSRF wording in place, on both the payload and the
 * error. Callers render `response.data.error` verbatim, and "CSRF token
 * required" tells a visitor nothing about what to do next.
 */
export const withCsrfUserMessage = <T>(error: ApiError<T>): ApiError<T> => {
  const data: unknown = error.response?.data;
  // Narrowing to a bare record first: `T & Record<string, unknown>` still has no
  // declared `error` key, so assigning through the generic is a type error even
  // though the runtime object is a plain JSON payload.
  if (isRecord(data)) {
    (data as Record<string, unknown>).error = CSRF_USER_MESSAGE;
  }
  error.customMessage = CSRF_USER_MESSAGE;
  return error;
};

/**
 * The first response interceptor registered in the source. It runs before the
 * auth handler and only annotates — it never swallows.
 */
export const decorateTransportError = (error: ApiError): ApiError => {
  if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
    error.isTimeout = true;
    error.customMessage =
      "Request timed out. Please check your connection and try again.";
  } else if (!error.response) {
    error.isNetworkError = true;
    error.customMessage =
      "Unable to connect to server. Please check your internet connection.";
  }
  return error;
};
