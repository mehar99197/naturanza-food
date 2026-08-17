/**
 * Admin Security Center: 2FA, device sessions and the IP allowlist.
 *
 * Kept as its own exported object (`adminSecurityAPI`) rather than folded into
 * `adminAPI`, matching the source — these are the endpoints an admin uses on
 * themselves, not the ones they use on the store.
 */

import { apiClient } from "./client";

export const adminSecurityAPI = {
  /** GET /admin/security/overview */
  getOverview: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/security/overview"),

  /** GET /admin/security/sessions */
  getSessions: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/security/sessions"),

  /** POST /admin/security/sessions/:id/revoke — no body. */
  revokeSession: <T = unknown>(sessionId: string | number): Promise<T> =>
    apiClient.post<T>(`/admin/security/sessions/${sessionId}/revoke`),

  /** POST /admin/security/sessions/revoke-others — no body. */
  revokeOtherSessions: <T = unknown>(): Promise<T> =>
    apiClient.post<T>("/admin/security/sessions/revoke-others"),

  /** POST /admin/security/2fa/setup — returns the enrolment secret/QR. */
  setupTwoFactor: <T = unknown>(): Promise<T> =>
    apiClient.post<T>("/admin/security/2fa/setup"),

  /** POST /admin/security/2fa/enable */
  enableTwoFactor: <T = unknown>(code: string): Promise<T> =>
    apiClient.post<T>("/admin/security/2fa/enable", { code }),

  /** POST /admin/security/2fa/disable — needs password *and* a current code. */
  disableTwoFactor: <T = unknown>(payload: {
    password: string;
    code: string;
  }): Promise<T> =>
    apiClient.post<T>("/admin/security/2fa/disable", {
      password: payload.password,
      code: payload.code,
    }),

  /** POST /admin/security/2fa/recovery-codes */
  regenerateRecoveryCodes: <T = unknown>(code: string): Promise<T> =>
    apiClient.post<T>("/admin/security/2fa/recovery-codes", { code }),

  /** GET /admin/security/ip-allowlist */
  getIpAllowlist: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/security/ip-allowlist"),

  /** POST /admin/security/ip-allowlist */
  addIpAllowlistEntry: <T = unknown>(entry: {
    label: string;
    cidr: string;
  }): Promise<T> =>
    apiClient.post<T>("/admin/security/ip-allowlist", {
      label: entry.label,
      cidr: entry.cidr,
    }),

  /** DELETE /admin/security/ip-allowlist/:id */
  deleteIpAllowlistEntry: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/security/ip-allowlist/${id}`),
};
