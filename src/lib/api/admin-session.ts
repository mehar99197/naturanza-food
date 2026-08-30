/**
 * Admin sign-in, dashboard and store settings.
 *
 * Several reads short-circuit to an empty value when no admin token is held.
 * That is not a cache — it stops the dashboard firing a fan-out of guaranteed
 * 401s while the session is still being established, each of which would burn
 * a retry and a refresh attempt.
 */

import { apiClient } from "./client";
import { isApiError } from "./errors";
import { readAdminToken } from "./payload";
import {
  clearAdminAccessToken,
  emitAuthSessionSync,
  getAdminAccessToken,
  setAdminAccessToken,
} from "./session";
import type { AdminVerifyFailure, QueryParams, RequestBody } from "./types";

const adoptAdminSession = <T>(payload: T): T => {
  const token = readAdminToken(payload);
  if (token) {
    setAdminAccessToken(token);
  }
  return payload;
};

export const adminSessionEndpoints = {
  /**
   * POST /admin/login — super-admin gate only. The backend rejects accounts
   * whose `admin_role !== 'super_admin'`.
   */
  login: async <T = unknown>(credentials: RequestBody): Promise<T> =>
    adoptAdminSession(await apiClient.post<T>("/admin/login", credentials)),

  /**
   * POST /admin/staff-login — staff gate. The backend accepts
   * staff_admin / admin / moderator and rejects super_admin. Returns the same
   * token shape as super-admin login so the rest of the admin app (shared
   * dashboard, permissions) keeps working unchanged.
   */
  staffLogin: async <T = unknown>(credentials: RequestBody): Promise<T> =>
    adoptAdminSession(await apiClient.post<T>("/admin/staff-login", credentials)),

  /**
   * POST /admin/forgot-password — admin-side password recovery.
   *
   * Distinct from `userAPI.forgotPassword` (which targets the storefront
   * `/auth` routes) and from `adminAPI.resetPassword` (which is a super-admin
   * forcing a reset on someone else's account).
   */
  forgotPassword: <T = unknown>(email: string): Promise<T> =>
    apiClient.post<T>("/admin/forgot-password", { email }),

  /** POST /admin/reset-password */
  resetPasswordWithToken: <T = unknown>(payload: RequestBody): Promise<T> =>
    apiClient.post<T>("/admin/reset-password", payload),

  /**
   * GET /admin/verify.
   *
   * Resolves rather than rejects on failure so the admin shell can tell "not
   * logged in" from "server unreachable" without a try/catch at every guard.
   */
  verify: async <T = unknown>(): Promise<T | AdminVerifyFailure> => {
    try {
      return await apiClient.get<T>("/admin/verify");
    } catch (error) {
      const response = isApiError(error) ? error.response : undefined;
      return {
        success: false,
        status: response?.status || null,
        networkError: !response,
      };
    }
  },

  /** POST /admin/logout. A failed request still clears the local session. */
  logout: async (): Promise<{ success: true }> => {
    try {
      await apiClient.post("/admin/logout");
    } catch {
      /* ignored: not fatal to this flow */
    }
    clearAdminAccessToken();
    emitAuthSessionSync("admin-logout");
    return { success: true };
  },

  /** GET /admin/dashboard/stats */
  getDashboardStats: async <T = unknown>(): Promise<T | Record<string, never>> => {
    if (!getAdminAccessToken()) {
      return {};
    }
    return apiClient.get<T>("/admin/dashboard/stats");
  },

  /** GET /admin/settings */
  getSettings: <T = unknown>(): Promise<T> => apiClient.get<T>("/admin/settings"),

  /** PUT /admin/settings */
  updateSettings: <T = unknown>(settings: RequestBody): Promise<T> =>
    apiClient.put<T>("/admin/settings", settings),

  /** POST /admin/settings/test-email */
  sendTestEmail: <T = unknown>(email: string): Promise<T> =>
    apiClient.post<T>("/admin/settings/test-email", { email }),

  /** GET /admin/dashboard/recent-orders */
  getRecentOrders: async <T = unknown>(limit = 10): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/dashboard/recent-orders", {
      params: { limit },
    });
  },

  /** GET /admin/reports/sales */
  getSalesReport: async <T = unknown>(
    params: QueryParams = {},
  ): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/reports/sales", { params });
  },

  /** GET /admin/reports/products */
  getProductSalesReport: async <T = unknown>(
    params: QueryParams = {},
  ): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/reports/products", { params });
  },
};
