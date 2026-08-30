/**
 * Shared request/response vocabulary for the API client.
 *
 * Response payloads are deliberately left as `unknown` unless the ported source
 * itself reads a field off them — the Express layer is the authority on those
 * shapes and inventing interfaces here would be guesswork that type-checks.
 * Resource methods are generic with an `unknown` default so a call site that
 * *does* know the shape can supply it instead of writing a cast.
 */

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/** Only the two axios `responseType` values the source actually uses. */
export type ApiResponseType = "json" | "blob";

/** A single query-string value, matching what axios's serializer accepts. */
export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ReadonlyArray<string | number | boolean | null>;

export type QueryParams = Readonly<Record<string, QueryParamValue>>;

/** A JSON request body — serialized with `JSON.stringify`, like axios does. */
export type JsonBody = Record<string, unknown> | readonly unknown[];

/**
 * Everything that can be handed to a request as a body. Non-JSON members are
 * passed to `fetch` untouched, mirroring axios's `transformRequest`, which
 * returns `FormData`/`Blob`/`ArrayBuffer` unchanged so the browser can set the
 * multipart boundary itself.
 */
export type RequestBody =
  | FormData
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | URLSearchParams
  | string
  | JsonBody
  | null
  | undefined;

/** Per-call options, i.e. everything about a request except method and URL. */
export interface RequestOptions {
  data?: RequestBody;
  params?: QueryParams;
  headers?: Readonly<Record<string, string>>;
  /** Milliseconds before the request is aborted. Defaults to 10 000. */
  timeout?: number;
  responseType?: ApiResponseType;
}

export interface RequestConfig extends RequestOptions {
  url: string;
  method?: HttpMethod;
}

/**
 * Which token, if any, the request interceptor put on the request. Carried
 * through to the error handler, which uses it to decide whether a 401 should
 * invalidate the admin session.
 */
export type AuthScope = "none" | "user" | "admin";

/**
 * The mutable state a single request carries through the pipeline, including
 * retries. This is the typed replacement for the ad-hoc properties the source
 * hung off the axios config object (`_authScope`, `_retry`, `_refreshRetry`,
 * `_csrfRetry`); the retry flags exist purely to stop a retry looping.
 */
export interface RequestState extends RequestConfig {
  method: HttpMethod;
  headers: Record<string, string>;
  authScope: AuthScope;
  /** Set by the admin 401 path. */
  retry: boolean;
  /** Set by the user 401/403 refresh path. */
  refreshRetry: boolean;
  /** Set by the 403 CSRF path. */
  csrfRetry: boolean;
}

/** Response headers, lower-cased, as axios exposes them. */
export type ResponseHeaders = Readonly<Record<string, string>>;

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: ResponseHeaders;
  config: RequestState;
}

/** Payload shape of `GET /api/csrf-token`. */
export interface CsrfTokenResponse {
  csrfToken?: string | null;
}

/**
 * Every endpoint that mints a session returns the access token under one of two
 * names; the source reads `accessToken` first and falls back to `token`, and
 * the admin endpoints return only `token`.
 */
export interface AccessTokenResponse {
  accessToken?: string | null;
  token?: string | null;
}

/** What `orderAPI.getAdminPage` normalises the admin order list down to. */
export interface PaginatedResult<T = unknown> {
  data: T[];
  total: number;
}

/** What `orderAPI.downloadInvoice` resolves to. */
export interface InvoiceDownload {
  blob: Blob;
  filename: string;
  status: number;
  contentType: string;
}

/** What `adminAPI.verify` resolves to when the verify call fails. */
export interface AdminVerifyFailure {
  success: false;
  status: number | null;
  networkError: boolean;
}
