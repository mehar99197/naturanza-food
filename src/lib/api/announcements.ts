/** Site-wide announcement bar. `getActive` is public; the rest are admin. */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const announcementAPI = {
  /** GET /announcements/active */
  getActive: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/announcements/active"),

  /** GET /announcements */
  getAll: <T = unknown>(): Promise<T> => apiClient.get<T>("/announcements"),

  /** POST /announcements */
  create: <T = unknown>(data: RequestBody): Promise<T> =>
    apiClient.post<T>("/announcements", data),

  /** PUT /announcements/:id */
  update: <T = unknown>(id: string | number, data: RequestBody): Promise<T> =>
    apiClient.put<T>(`/announcements/${id}`, data),

  /** DELETE /announcements/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/announcements/${id}`),
};
