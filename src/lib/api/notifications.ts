/**
 * Notification endpoints, shared by the storefront and the admin dashboard.
 *
 * The source declares these twice — once on `userAPI`, once on `adminAPI` with
 * the comment "use same endpoints but with admin token". Nothing about the
 * request differs between the two: `/auth/notifications` is a user-scoped
 * route, so the request interceptor attaches the admin token purely because
 * `isAdminPage()` is true while the dashboard is open. One implementation is
 * therefore byte-identical to both, and it stays that way.
 */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const notificationEndpoints = {
  /** GET /auth/notifications */
  getNotifications: <T = unknown>(limit = 30): Promise<T> =>
    apiClient.get<T>("/auth/notifications", { params: { limit } }),

  /** PATCH /auth/notifications/:id/read */
  markNotificationRead: <T = unknown>(
    notificationId: string | number,
  ): Promise<T> =>
    apiClient.patch<T>(`/auth/notifications/${notificationId}/read`),

  /** PATCH /auth/notifications/read-all */
  markAllNotificationsRead: <T = unknown>(): Promise<T> =>
    apiClient.patch<T>("/auth/notifications/read-all"),

  /** DELETE /auth/notifications/:id */
  deleteNotification: <T = unknown>(
    notificationId: string | number,
  ): Promise<T> => apiClient.delete<T>(`/auth/notifications/${notificationId}`),

  /**
   * DELETE /auth/notifications
   *
   * `readOnly` narrows the purge to already-read items via `?read=true`;
   * omitting it sends no params at all and clears everything.
   */
  clearNotifications: <T = unknown>(
    options: { readOnly?: boolean } = {},
  ): Promise<T> =>
    apiClient.delete<T>("/auth/notifications", {
      params: options.readOnly ? { read: "true" } : {},
    }),

  /** GET /auth/notifications/settings */
  getNotificationSettings: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/auth/notifications/settings"),

  /** PUT /auth/notifications/settings */
  updateNotificationSettings: <T = unknown>(settings: RequestBody): Promise<T> =>
    apiClient.put<T>("/auth/notifications/settings", settings),
};

/**
 * The storefront also polls an unread badge. The source declares this one on
 * `userAPI` only — `adminAPI` has no counterpart — so it is spread in
 * separately rather than added to the shared set.
 */
export const userNotificationEndpoints = {
  ...notificationEndpoints,

  /** GET /auth/notifications/unread-count */
  getNotificationsUnreadCount: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/auth/notifications/unread-count"),
};

/** The admin dashboard wires up exactly the shared set, and nothing more. */
export const adminNotificationEndpoints = notificationEndpoints;
