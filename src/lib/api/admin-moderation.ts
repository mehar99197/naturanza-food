/**
 * The admin's review queues: payment verifications, product reviews, returns
 * and the printable barcode label.
 */

import { apiClient } from "./client";
import { getAdminAccessToken } from "./session";
import type { QueryParams, RequestBody } from "./types";

export const adminModerationEndpoints = {
  /**
   * GET /admin/payments/verifications.
   *
   * `stage` is omitted rather than sent as null when not supplied, so the
   * server applies its own default rather than filtering on an empty value.
   */
  getPaymentVerifications: <T = unknown>(
    status = "pending",
    stage: string | null = null,
  ): Promise<T> => {
    const params: QueryParams = stage ? { status, stage } : { status };
    return apiClient.get<T>("/admin/payments/verifications", { params });
  },

  /** GET /admin/payments/verifications/:id/screenshot — the proof-of-payment image. */
  getPaymentVerificationScreenshot: (
    verificationId: string | number,
  ): Promise<Blob> =>
    apiClient.get<Blob>(
      `/admin/payments/verifications/${verificationId}/screenshot`,
      { responseType: "blob" },
    ),

  /** GET /admin/payments/analytics */
  getPaymentAnalytics: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/admin/payments/analytics"),

  /** PUT /admin/payments/verifications/:id/approve — note omitted, not null. */
  approvePaymentVerification: <T = unknown>(
    verificationId: string | number,
    adminNote: string | null = null,
  ): Promise<T> =>
    apiClient.put<T>(
      `/admin/payments/verifications/${verificationId}/approve`,
      adminNote ? { admin_note: adminNote } : {},
    ),

  /** PUT /admin/payments/verifications/:id/reject */
  rejectPaymentVerification: <T = unknown>(
    verificationId: string | number,
    reason: string,
  ): Promise<T> =>
    apiClient.put<T>(
      `/admin/payments/verifications/${verificationId}/reject`,
      { reason },
    ),

  /** GET /admin/returns */
  getReturns: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/admin/returns", { params }),

  /** PUT /admin/returns/:id/status */
  updateReturnStatus: <T = unknown>(
    returnRequestId: string | number,
    payload: RequestBody,
  ): Promise<T> =>
    apiClient.put<T>(`/admin/returns/${returnRequestId}/status`, payload),

  /** GET /admin/reviews */
  getReviews: async <T = unknown>(
    params: QueryParams = {},
  ): Promise<T | never[]> => {
    if (!getAdminAccessToken()) {
      return [];
    }
    return apiClient.get<T>("/admin/reviews", { params });
  },

  /** PATCH /admin/reviews/:id/approval */
  updateReviewApproval: <T = unknown>(
    reviewId: string | number,
    isApproved: boolean,
  ): Promise<T> =>
    apiClient.patch<T>(`/admin/reviews/${reviewId}/approval`, {
      is_approved: isApproved,
    }),

  /** DELETE /admin/reviews/:id */
  deleteReview: <T = unknown>(reviewId: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/reviews/${reviewId}`),

  /** GET /admin/products/:id/barcode-data — drives the printable POS label. */
  getProductBarcodeData: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.get<T>(`/admin/products/${productId}/barcode-data`),
};
