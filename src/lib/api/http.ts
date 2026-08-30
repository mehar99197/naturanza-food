/**
 * The transport: one request, no auth, no CSRF, no retries.
 *
 * This is the `fetch` equivalent of the axios adapter, and nothing above it
 * knows about `fetch`. It reproduces the four adapter behaviours the app
 * depends on: `withCredentials` (cookies on every request, which is how the
 * refresh token and the CSRF cookie travel), the 10s timeout surfacing as
 * `ECONNABORTED`, `validateStatus` rejecting outside 2xx, and the response
 * being parsed by `responseType`.
 */

import {
  DEFAULT_ACCEPT_HEADER,
  DEFAULT_TIMEOUT_MS,
  getApiBaseUrl,
} from "./config";
import { ApiError } from "./errors";
import { buildUrl, joinBaseUrl, parseJsonBody, prepareBody } from "./serialize";
import type { ApiResponse, RequestState, ResponseHeaders } from "./types";

/** axios's default `validateStatus`. */
const isSuccessStatus = (status: number): boolean => status >= 200 && status < 300;

const toHeaderRecord = (headers: Headers): ResponseHeaders => {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
};

/**
 * Header lookup that ignores case, because callers write both
 * `X-Skip-Auth-Refresh` and `x-skip-auth-refresh`.
 */
export const readHeader = (
  headers: Readonly<Record<string, string>>,
  name: string,
): string | undefined => {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
};

/** Deletes every casing of a header name. */
export const deleteHeader = (
  headers: Record<string, string>,
  name: string,
): void => {
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      delete headers[key];
    }
  }
};

const parsePayload = async (
  response: Response,
  responseType: RequestState["responseType"],
): Promise<unknown> => {
  if (responseType === "blob") {
    return response.blob();
  }
  return parseJsonBody(await response.text());
};

/**
 * Sends one request and resolves with an axios-shaped response, or rejects with
 * an {@link ApiError} carrying the same `response`/`code` fields axios used.
 */
export const performRequest = async (
  state: RequestState,
): Promise<ApiResponse<unknown>> => {
  const url = buildUrl(joinBaseUrl(getApiBaseUrl(), state.url), state.params);
  const { body, contentType, stripContentType } = prepareBody(state.data);

  const headers: Record<string, string> = {
    Accept: DEFAULT_ACCEPT_HEADER,
    ...state.headers,
  };

  if (stripContentType) {
    // Setting it ourselves would omit the multipart boundary and the upload
    // would arrive at multer as an unparseable body.
    deleteHeader(headers, "Content-Type");
  } else if (contentType && readHeader(headers, "Content-Type") === undefined) {
    headers["Content-Type"] = contentType;
  }

  const timeoutMs = state.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: state.method,
      headers,
      // The axios instances were created with `withCredentials: true`. The
      // refresh token and the CSRF cookie are both HttpOnly, so dropping this
      // silently logs every user out on their next refresh.
      credentials: "include",
      ...(body === undefined ? {} : { body }),
      signal: controller.signal,
    });
  } catch (cause) {
    clearTimeout(timer);
    if (timedOut) {
      throw new ApiError(`timeout of ${timeoutMs}ms exceeded`, {
        code: "ECONNABORTED",
        config: state,
      });
    }
    // axios reports every transport failure with this exact wording, and
    // `orderAPI.downloadInvoice` matches on it to decide whether to retry.
    throw new ApiError("Network Error", {
      code: cause instanceof Error ? cause.name : undefined,
      config: state,
    });
  }
  clearTimeout(timer);

  const responseHeaders = toHeaderRecord(response.headers);
  const data = await parsePayload(response, state.responseType);

  if (!isSuccessStatus(response.status)) {
    throw new ApiError(
      `Request failed with status code ${response.status}`,
      {
        config: state,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          data,
        },
      },
    );
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    config: state,
  };
};
