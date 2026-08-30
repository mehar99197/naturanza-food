/**
 * Account security screens (`/profile/*`) — password, device sessions and
 * account deletion. Distinct from `/auth/profile`, which is the profile record.
 */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const profileSecurityAPI = {
  /** PUT /profile/change-password */
  changePassword: <T = unknown>(payload: RequestBody): Promise<T> =>
    apiClient.put<T>("/profile/change-password", payload),

  /** GET /profile/login-history */
  getLoginHistory: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/profile/login-history"),

  /** GET /profile/active-sessions */
  getActiveSessions: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/profile/active-sessions"),

  /** POST /profile/logout-device/:sessionId — no body. */
  logoutDevice: <T = unknown>(sessionId: string | number): Promise<T> =>
    apiClient.post<T>(`/profile/logout-device/${sessionId}`),

  /** POST /profile/logout-all-other-devices — no body. */
  logoutAllOtherDevices: <T = unknown>(): Promise<T> =>
    apiClient.post<T>("/profile/logout-all-other-devices"),

  /**
   * DELETE /profile/delete-account
   *
   * Carries a body (the password confirmation) on a DELETE, which is why it
   * goes through the options object rather than a positional argument.
   */
  deleteAccount: <T = unknown>(payload: RequestBody): Promise<T> =>
    apiClient.delete<T>("/profile/delete-account", { data: payload }),
};
