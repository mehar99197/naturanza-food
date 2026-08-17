/** Customer return requests and the admin queue that reads them. */

import { apiClient } from "./client";
import type { QueryParams, RequestBody } from "./types";

export const returnAPI = {
  /** POST /returns/request */
  createRequest: <T = unknown>(payload: RequestBody): Promise<T> =>
    apiClient.post<T>("/returns/request", payload),

  /** GET /returns/my */
  getMyReturns: <T = unknown>(): Promise<T> => apiClient.get<T>("/returns/my"),

  /** GET /returns/:id */
  getById: <T = unknown>(returnRequestId: string | number): Promise<T> =>
    apiClient.get<T>(`/returns/${returnRequestId}`),

  /** GET /returns/admin/all */
  getAdminAll: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/returns/admin/all", { params }),
};
