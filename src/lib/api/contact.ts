/** Contact form submissions and the admin inbox that reads them. */

import { apiClient } from "./client";
import type { QueryParams, RequestBody } from "./types";

export const contactAPI = {
  /** POST /contact — public. */
  sendMessage: <T = unknown>(messageData: RequestBody): Promise<T> =>
    apiClient.post<T>("/contact", messageData),

  /** GET /contact — admin inbox. */
  getAll: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/contact", { params }),

  /** GET /contact/:id */
  getById: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/contact/${id}`),

  /** PUT /contact/:id/status */
  updateStatus: <T = unknown>(id: string | number, status: string): Promise<T> =>
    apiClient.put<T>(`/contact/${id}/status`, { status }),

  /** DELETE /contact/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/contact/${id}`),
};
