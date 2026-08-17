/**
 * Reading messages back off a failed request.
 *
 * Every context ported into this folder wrote the same two expressions against
 * an untyped error object:
 *
 *   err.response?.data?.error || "Failed to …"
 *   err.message
 *
 * Under `strict` those need a narrowing step, and the narrowing has to keep the
 * original's falsy handling *exactly* — the difference between `||` and `??`
 * here is the difference between a visitor seeing "Failed to add to cart" and
 * seeing an empty toast. These helpers are that narrowing step and nothing more.
 *
 * `apiClient` funnels everything it throws through `ApiError` (see
 * `toApiError` in @/lib/api/client), so `isApiError` covers every rejection a
 * provider can observe from the API; anything else is a locally thrown `Error`,
 * which `errorText` handles.
 */

import { isApiError, isRecord, statusOf } from "@/lib/api/errors";

/**
 * `String(value || "")` for an `unknown`.
 *
 * Written as a conditional rather than `String(value ?? "")` because the source
 * used `||`: `false`, `0` and `""` all have to collapse to `""`, not to
 * `"false"` / `"0"`.
 */
export const asText = (value: unknown): string => (value ? String(value) : "");

/**
 * The JSON body of an error response, or `{}` when there isn't one.
 *
 * Mirrors `const responseData = err.response?.data || {}` from the source,
 * including the case where the server answered with a non-object body — the
 * source read `.code`/`.error` off it and got `undefined`, and so does this.
 */
export const errorData = (error: unknown): Record<string, unknown> => {
  if (!isApiError(error)) {
    return {};
  }
  const data: unknown = error.response?.data;
  return isRecord(data) ? data : {};
};

/** `error.response?.data?.error` as a string, or `""` when absent. */
export const apiErrorText = (error: unknown): string =>
  asText(errorData(error).error);

/** `error.message`, or `""` for something that was thrown but isn't an Error. */
export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "";

/**
 * `Number(err?.response?.status || 0)`. Re-exported under the name the ported
 * code reads better with; 0 means "no HTTP status", e.g. a network failure.
 */
export const errorStatus = statusOf;
