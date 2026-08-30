/**
 * Store configuration an admin edits: coupons, per-city delivery fees,
 * inventory movements, tax rates and payment methods/accounts.
 *
 * Note the coupon endpoints are *not* under `/admin` — they are plain
 * `/coupons` routes gated server-side. That means the request interceptor only
 * attaches the admin token because the browser is on an `/admin` page; see
 * `applyAuthHeader`.
 */

import { apiClient } from "./client";
import { getAdminAccessToken } from "./session";
import type { QueryParams, RequestBody } from "./types";

export const adminCommerceEndpoints = {
  /** GET /coupons */
  getCoupons: async <T = unknown>(): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/coupons");
  },

  /** POST /coupons */
  createCoupon: <T = unknown>(couponData: RequestBody): Promise<T> =>
    apiClient.post<T>("/coupons", couponData),

  /** PUT /coupons/:id */
  updateCoupon: <T = unknown>(
    id: string | number,
    couponData: RequestBody,
  ): Promise<T> => apiClient.put<T>(`/coupons/${id}`, couponData),

  /** DELETE /coupons/:id */
  deleteCoupon: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/coupons/${id}`),

  /** PATCH /coupons/:id/toggle — no body. */
  toggleCouponStatus: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.patch<T>(`/coupons/${id}/toggle`),

  /** GET /admin/shipping/city-fees */
  getShippingCities: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/shipping/city-fees"),

  /** POST /admin/shipping/city-fees */
  createShippingCity: <T = unknown>(cityData: RequestBody): Promise<T> =>
    apiClient.post<T>("/admin/shipping/city-fees", cityData),

  /** PUT /admin/shipping/city-fees/:id */
  updateShippingCity: <T = unknown>(
    id: string | number,
    cityData: RequestBody,
  ): Promise<T> =>
    apiClient.put<T>(`/admin/shipping/city-fees/${id}`, cityData),

  /** DELETE /admin/shipping/city-fees/:id */
  deleteShippingCity: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/shipping/city-fees/${id}`),

  /** GET /admin/inventory/movements — the stock ledger. */
  getInventoryMovements: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/admin/inventory/movements", { params }),

  /** GET /admin/tax-rates */
  getTaxRates: <T = unknown>(): Promise<T> => apiClient.get<T>("/admin/tax-rates"),

  /** POST /admin/tax-rates */
  createTaxRate: <T = unknown>(taxRateData: RequestBody): Promise<T> =>
    apiClient.post<T>("/admin/tax-rates", taxRateData),

  /** PUT /admin/tax-rates/:id */
  updateTaxRate: <T = unknown>(
    taxRateId: string | number,
    taxRateData: RequestBody,
  ): Promise<T> => apiClient.put<T>(`/admin/tax-rates/${taxRateId}`, taxRateData),

  /** DELETE /admin/tax-rates/:id */
  deleteTaxRate: <T = unknown>(taxRateId: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/tax-rates/${taxRateId}`),

  /** GET /admin/payment-methods */
  getPaymentMethods: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/payment-methods"),

  /** POST /admin/payment-methods */
  createPaymentMethod: <T = unknown>(
    paymentMethodData: RequestBody,
  ): Promise<T> => apiClient.post<T>("/admin/payment-methods", paymentMethodData),

  /** PUT /admin/payment-methods/:id */
  updatePaymentMethod: <T = unknown>(
    paymentMethodId: string | number,
    paymentMethodData: RequestBody,
  ): Promise<T> =>
    apiClient.put<T>(
      `/admin/payment-methods/${paymentMethodId}`,
      paymentMethodData,
    ),

  /** DELETE /admin/payment-methods/:id */
  deletePaymentMethod: <T = unknown>(
    paymentMethodId: string | number,
  ): Promise<T> =>
    apiClient.delete<T>(`/admin/payment-methods/${paymentMethodId}`),

  /** GET /admin/payments/accounts */
  getPaymentAccounts: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/payments/accounts"),

  /** PUT /admin/payments/accounts/:id */
  updatePaymentAccount: <T = unknown>(
    accountId: string | number,
    payload: RequestBody,
  ): Promise<T> =>
    apiClient.put<T>(`/admin/payments/accounts/${accountId}`, payload),
};
