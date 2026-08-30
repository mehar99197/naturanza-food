/** Customer address book, all under `/auth/addresses`. */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const addressEndpoints = {
  /** GET /auth/addresses */
  getAddresses: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/auth/addresses"),

  /** POST /auth/addresses */
  addAddress: <T = unknown>(addressData: RequestBody): Promise<T> =>
    apiClient.post<T>("/auth/addresses", addressData),

  /** PUT /auth/addresses/:id */
  updateAddress: <T = unknown>(
    addressId: string | number,
    addressData: RequestBody,
  ): Promise<T> => apiClient.put<T>(`/auth/addresses/${addressId}`, addressData),

  /** DELETE /auth/addresses/:id */
  deleteAddress: <T = unknown>(addressId: string | number): Promise<T> =>
    apiClient.delete<T>(`/auth/addresses/${addressId}`),

  /** PATCH /auth/addresses/:id/default — no body. */
  setDefaultAddress: <T = unknown>(addressId: string | number): Promise<T> =>
    apiClient.patch<T>(`/auth/addresses/${addressId}/default`),

  /**
   * PUT /auth/addresses/default
   *
   * Creates-or-updates the default address in one call, which is what checkout
   * needs when a guest fills the form for the first time.
   */
  upsertDefaultAddress: <T = unknown>(addressData: RequestBody): Promise<T> =>
    apiClient.put<T>("/auth/addresses/default", addressData),
};
