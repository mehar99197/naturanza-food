/**
 * URL and body serialization, reproduced byte-for-byte from axios 1.x.
 *
 * The Vite app talked to these 200-odd Express endpoints through axios. This
 * port uses `fetch` (axios is not a dependency of the Next app), so everything
 * axios did on the way out has to be done here explicitly — otherwise the bytes
 * on the wire change even though the endpoint list does not.
 *
 * The two things that are easy to get subtly wrong, and are therefore copied
 * from axios source rather than reinvented:
 *   - the query encoder, which un-escapes `:`, `$`, `,` and turns spaces into
 *     `+` after `encodeURIComponent` (lib/helpers/buildURL.js);
 *   - `transformRequest`, which sets `Content-Type: application/json` only for
 *     object payloads and only when it is not already set, and which leaves
 *     `FormData` alone so the browser can write its own multipart boundary.
 */

import type { QueryParams, QueryParamValue, RequestBody } from "./types";

/**
 * axios's `encode` from lib/helpers/buildURL.js. `URLSearchParams` would encode
 * `:` `$` `,` as percent-escapes instead; Express decodes both identically, but
 * matching axios keeps request logs and any signature-style middleware stable.
 */
const encodeQueryPart = (value: string): string =>
  encodeURIComponent(value)
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+");

/** axios's `convertValue`: null becomes empty, Dates become ISO strings. */
const stringifyParam = (value: string | number | boolean | null | Date): string => {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/**
 * Serializes a params object the way axios's default `AxiosURLSearchParams`
 * does: `undefined` entries are dropped entirely, and a flat array is repeated
 * under a `key[]` name.
 */
export const serializeParams = (params: QueryParams | undefined): string => {
  if (!params) return "";

  const pairs: string[] = [];

  const push = (key: string, value: string | number | boolean | null | Date): void => {
    pairs.push(`${encodeQueryPart(key)}=${encodeQueryPart(stringifyParam(value))}`);
  };

  for (const [key, value] of Object.entries(params) as Array<
    [string, QueryParamValue]
  >) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        push(`${key}[]`, item);
      }
      continue;
    }

    push(key, value as string | number | boolean | null | Date);
  }

  return pairs.join("&");
};

/** Joins the configured base onto a request path with exactly one slash. */
export const joinBaseUrl = (baseUrl: string, url: string): string => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const base = baseUrl.replace(/\/+$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
};

/** axios's `buildURL`: strips any fragment, then appends with `?` or `&`. */
export const buildUrl = (url: string, params: QueryParams | undefined): string => {
  const serialized = serializeParams(params);
  if (!serialized) return url;

  const hashIndex = url.indexOf("#");
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  return `${withoutHash}${withoutHash.includes("?") ? "&" : "?"}${serialized}`;
};

const isBodyInitPassthrough = (value: RequestBody): boolean =>
  (typeof FormData !== "undefined" && value instanceof FormData) ||
  (typeof Blob !== "undefined" && value instanceof Blob) ||
  value instanceof ArrayBuffer ||
  ArrayBuffer.isView(value) ||
  (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
  typeof value === "string";

export interface PreparedBody {
  body: BodyInit | undefined;
  /** Content-Type to apply, or null to leave the header untouched. */
  contentType: string | null;
  /** True when the browser must own the header (multipart boundary). */
  stripContentType: boolean;
}

/**
 * axios's `transformRequest`, restricted to the payload kinds this app sends.
 *
 * `undefined` and `null` bodies produce no body and no `Content-Type` — which
 * is what `axios.post(url)` with no data did, and several endpoints here
 * (`/auth/logout`, `/coupons/:id/toggle`, `.../read-all`) rely on that.
 */
export const prepareBody = (data: RequestBody): PreparedBody => {
  if (data === undefined || data === null) {
    return { body: undefined, contentType: null, stripContentType: false };
  }

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return { body: data, contentType: null, stripContentType: true };
  }

  if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
    return {
      body: data.toString(),
      contentType: "application/x-www-form-urlencoded;charset=utf-8",
      stripContentType: false,
    };
  }

  if (isBodyInitPassthrough(data)) {
    return { body: data as BodyInit, contentType: null, stripContentType: false };
  }

  return {
    body: JSON.stringify(data),
    contentType: "application/json",
    stripContentType: false,
  };
};

/**
 * axios's default `transformResponse` for a `responseType`-less request:
 * forced-but-silent JSON parsing. A body that is not JSON comes back as the raw
 * string rather than throwing, and an empty body stays an empty string.
 */
export const parseJsonBody = (text: string): unknown => {
  if (!text) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};
