/**
 * Customer records under `/admin/users`.
 *
 * `getCustomers` and `getUsers` hit the same endpoint; the first is the
 * unfiltered call the customers screen makes, the second takes query params.
 * Both are kept because both are called.
 */

import { apiClient } from "./client";
import { getAdminAccessToken } from "./session";
import type { QueryParams, RequestBody } from "./types";

export const adminUserEndpoints = {
  /** GET /admin/users */
  getCustomers: async <T = unknown>(): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/users");
  },

  /** GET /admin/users, with filters. */
  getUsers: async <T = unknown>(
    params: QueryParams = {},
  ): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/users", { params });
  },

  /** POST /admin/users */
  createCustomer: <T = unknown>(customerData: RequestBody): Promise<T> =>
    apiClient.post<T>("/admin/users", customerData),

  /** PUT /admin/users/:id */
  updateCustomer: <T = unknown>(
    customerId: string | number,
    customerData: RequestBody,
  ): Promise<T> => apiClient.put<T>(`/admin/users/${customerId}`, customerData),

  /** PATCH /admin/users/:id/status */
  updateCustomerStatus: <T = unknown>(
    customerId: string | number,
    isActive: boolean,
  ): Promise<T> =>
    apiClient.patch<T>(`/admin/users/${customerId}/status`, {
      is_active: isActive,
    }),

  /** PUT /admin/users/:id/role */
  updateCustomerRole: <T = unknown>(
    customerId: string | number,
    role: string,
  ): Promise<T> => apiClient.put<T>(`/admin/users/${customerId}/role`, { role }),

  /** DELETE /admin/users/:id */
  deleteCustomer: <T = unknown>(customerId: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/users/${customerId}`),
};
