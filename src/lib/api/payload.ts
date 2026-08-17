/**
 * Payload shape helpers.
 *
 * A handful of list endpoints answer with a bare array on some deployments and
 * a `{ data, total }` envelope on others — the source tolerates both so a
 * browser holding a cached bundle keeps working against a server that has not
 * been redeployed yet. These helpers keep that tolerance in one place instead
 * of repeating the `Array.isArray(...) ? ... : ...?.data` dance.
 */

import { isRecord } from "./errors";

/** Unwraps either a bare array or a `{ data: [...] }` envelope. */
export const asList = <T = unknown>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data as T[];
  }
  return [];
};

/** Reads a numeric field off an unknown payload, defaulting to 0. */
export const asCount = (payload: unknown, key: string): number => {
  if (!isRecord(payload)) return 0;
  return Number(payload[key]) || 0;
};

/**
 * Pulls the access token out of a login/register/refresh response. Every such
 * endpoint returns it as `accessToken`, except the admin ones which return
 * `token`; the source reads them in that order everywhere.
 */
export const readAccessToken = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const token = payload.accessToken || payload.token;
  return token ? String(token) : null;
};

/** Reads only the admin-shaped `token` field. */
export const readAdminToken = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  return payload.token ? String(payload.token) : null;
};
