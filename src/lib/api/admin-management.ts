/**
 * `/admin-management/*` — super-admin control over other admin accounts.
 *
 * Separate from `/admin/users`: those are customers, these are staff, and the
 * route prefix is what `isAdminEndpoint` keys the 401-retry off.
 */

import { apiClient } from "./client";
import type { QueryParams, RequestBody } from "./types";

export const adminManagementEndpoints = {
  /** GET /admin-management/admins */
  getAdmins: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/admin-management/admins", { params }),

  /**
   * POST /admin-management/admins.
   *
   * Takes prepared `FormData` — the create form carries a profile image
   * alongside the account fields.
   */
  createAdmin: <T = unknown>(formData: FormData): Promise<T> =>
    apiClient.post<T>("/admin-management/admins", formData),

  /** PATCH /admin-management/admins/:id/status */
  updateAdminStatus: <T = unknown>(
    adminId: string | number,
    status: string,
  ): Promise<T> =>
    apiClient.patch<T>(`/admin-management/admins/${adminId}/status`, { status }),

  /** PATCH /admin-management/admins/:id/role — role plus its permission grants. */
  updateAdminRole: <T = unknown>(
    adminId: string | number,
    role: string,
    permissions: unknown,
  ): Promise<T> =>
    apiClient.patch<T>(`/admin-management/admins/${adminId}/role`, {
      role,
      permissions,
    }),

  /** DELETE /admin-management/admins/:id/role */
  removeAdminRole: <T = unknown>(adminId: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin-management/admins/${adminId}/role`),

  /** POST /admin-management/admins/:id/profile-image (field `profile_image`). */
  updateAdminProfileImage: <T = unknown>(
    adminId: string | number,
    file: File | Blob,
  ): Promise<T> => {
    const formData = new FormData();
    formData.append("profile_image", file);
    return apiClient.post<T>(
      `/admin-management/admins/${adminId}/profile-image`,
      formData,
    );
  },

  /** DELETE /admin-management/admins/:id/profile-image */
  removeAdminProfileImage: <T = unknown>(adminId: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin-management/admins/${adminId}/profile-image`),

  /** GET /admin-management/admins/:id/logs — that admin's audit trail. */
  getAdminLogs: <T = unknown>(
    adminId: string | number,
    limit = 20,
  ): Promise<T> =>
    apiClient.get<T>(`/admin-management/admins/${adminId}/logs`, {
      params: { limit },
    }),

  /** PATCH /admin-management/admins/:id/change-password */
  changePassword: <T = unknown>(
    adminId: string | number,
    passwordData: RequestBody,
  ): Promise<T> =>
    apiClient.patch<T>(
      `/admin-management/admins/${adminId}/change-password`,
      passwordData,
    ),

  /**
   * POST /admin-management/admins/:id/reset-password — no body.
   *
   * A super-admin forcing a reset on someone else's account, as opposed to
   * `adminAPI.forgotPassword`, which is an admin recovering their own.
   */
  resetPassword: <T = unknown>(adminId: string | number): Promise<T> =>
    apiClient.post<T>(`/admin-management/admins/${adminId}/reset-password`),
};
