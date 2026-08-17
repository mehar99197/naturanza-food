/**
 * Team members shown on the About page.
 *
 * `getAll` and `getActive` are the opposite way round from the usual naming:
 * `/team/all` is the admin list and `/team` is the public, active-only one.
 */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const teamAPI = {
  /** GET /team/all — every member, active or not. */
  getAll: <T = unknown>(): Promise<T> => apiClient.get<T>("/team/all"),

  /** GET /team — active members only. */
  getActive: <T = unknown>(): Promise<T> => apiClient.get<T>("/team"),

  /** POST /team */
  create: <T = unknown>(data: RequestBody): Promise<T> =>
    apiClient.post<T>("/team", data),

  /** PUT /team/:id */
  update: <T = unknown>(id: string | number, data: RequestBody): Promise<T> =>
    apiClient.put<T>(`/team/${id}`, data),

  /** DELETE /team/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/team/${id}`),

  /** POST /team/upload-image (multipart field `profile_image`). */
  uploadImage: <T = unknown>(file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("profile_image", file);
    return apiClient.post<T>("/team/upload-image", formData);
  },
};
