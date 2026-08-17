/**
 * Storefront authentication (`/auth/*`) plus the profile it hangs off.
 *
 * Every endpoint here that mints a session stores the access token in memory
 * and fires the session-sync event; the refresh token never leaves its HttpOnly
 * cookie. The `source` string on each event is what tells listeners *why* the
 * session changed, so they stay distinct per entry point.
 */

import { addressEndpoints } from "./addresses";
import { apiClient, refreshUserAccessToken } from "./client";
import { notificationEndpoints } from "./notifications";
import { readAccessToken } from "./payload";
import {
  clearUserAccessToken,
  emitAuthSessionSync,
  setUserAccessToken,
} from "./session";
import type { AccessTokenResponse, RequestBody } from "./types";

/** Stores a freshly minted token and announces it. */
const adoptSession = <T>(payload: T, source: string): T => {
  const nextToken = readAccessToken(payload);
  if (nextToken) {
    setUserAccessToken(nextToken);
    emitAuthSessionSync(source);
  }
  return payload;
};

export interface VerifyEmailPayload {
  email: string;
  code: string;
  /**
   * Sent only on a retry, after the server answered PASSWORD_REQUIRED because
   * this code isn't bound to a password this browser set.
   */
  password?: string;
}

export const sessionEndpoints = {
  /** POST /auth/register */
  register: async <T = unknown>(userData: RequestBody): Promise<T> =>
    adoptSession(await apiClient.post<T>("/auth/register", userData), "user-register"),

  /** POST /auth/verify-email */
  verifyEmail: async <T = unknown>({
    email,
    code,
    password,
  }: VerifyEmailPayload): Promise<T> =>
    adoptSession(
      await apiClient.post<T>("/auth/verify-email", {
        email,
        code,
        ...(password ? { password } : {}),
      }),
      "user-verify-email",
    ),

  /** POST /auth/resend-verification */
  resendVerification: <T = unknown>(email: string): Promise<T> =>
    apiClient.post<T>("/auth/resend-verification", { email }),

  /** POST /auth/login */
  login: async <T = unknown>(credentials: RequestBody): Promise<T> =>
    adoptSession(await apiClient.post<T>("/auth/login", credentials), "user-login"),

  /** POST /auth/google */
  loginWithGoogle: async <T = unknown>(idToken: string): Promise<T> =>
    adoptSession(
      await apiClient.post<T>("/auth/google", { idToken }),
      "user-google-login",
    ),

  /**
   * POST /auth/refresh, via the shared single-flight refresh.
   *
   * Throws rather than resolving null so callers can treat "no session" as an
   * error path; the returned object carries the token under both names because
   * the source's consumers read either.
   */
  refreshToken: async (): Promise<Required<AccessTokenResponse>> => {
    const nextToken = await refreshUserAccessToken();
    if (!nextToken) {
      throw new Error("Refresh token missing or session ended");
    }
    return { accessToken: nextToken, token: nextToken };
  },

  /**
   * POST /auth/logout.
   *
   * `X-Skip-Auth-Refresh` matters here: without it a 401 from an already-dead
   * session would trigger a refresh and resurrect what we are tearing down. A
   * failed request is swallowed — the local session is cleared either way.
   */
  logout: async (): Promise<{ success: true }> => {
    try {
      await apiClient.post("/auth/logout", {}, {
        headers: { "X-Skip-Auth-Refresh": "true" },
      });
    } catch {
      /* ignored: not fatal to this flow */
    }
    clearUserAccessToken();
    emitAuthSessionSync("user-logout");
    return { success: true };
  },
};

export const userAPI = {
  ...sessionEndpoints,
  ...addressEndpoints,
  ...notificationEndpoints,

  /** GET /auth/profile */
  getProfile: <T = unknown>(): Promise<T> => apiClient.get<T>("/auth/profile"),

  /** PUT /auth/profile */
  updateProfile: <T = unknown>(profileData: RequestBody): Promise<T> =>
    apiClient.put<T>("/auth/profile", profileData),

  /** POST /auth/forgot-password */
  forgotPassword: <T = unknown>(data: RequestBody): Promise<T> =>
    apiClient.post<T>("/auth/forgot-password", data),

  /** POST /auth/reset-password */
  resetPassword: <T = unknown>(data: RequestBody): Promise<T> =>
    apiClient.post<T>("/auth/reset-password", data),

  /** GET /auth/stats — order/spend totals for the account dashboard. */
  getStats: <T = unknown>(): Promise<T> => apiClient.get<T>("/auth/stats"),

  /** POST /auth/profile/image — takes prepared multipart FormData. */
  uploadProfileImage: <T = unknown>(formData: FormData): Promise<T> =>
    apiClient.post<T>("/auth/profile/image", formData),

  /** DELETE /auth/profile/image */
  deleteProfileImage: <T = unknown>(): Promise<T> =>
    apiClient.delete<T>("/auth/profile/image"),
};
