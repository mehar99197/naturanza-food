/**
 * Customer-side payment verification.
 *
 * Pakistan's common rails (Easypaisa, JazzCash, bank transfer) are settled out
 * of band, so the customer uploads proof and an admin approves it — hence a
 * multipart submit rather than a gateway redirect.
 */

import { apiClient } from "./client";

export const paymentAPI = {
  /** GET /payments/methods/active */
  getActiveMethods: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/payments/methods/active"),

  /** GET /payments/accounts/active */
  getActiveAccounts: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/payments/accounts/active"),

  /**
   * POST /payments/submit-verification
   *
   * Takes a prepared `FormData` (the screenshot plus its metadata) so the
   * browser writes the multipart boundary itself.
   */
  submitVerification: <T = unknown>(formData: FormData): Promise<T> =>
    apiClient.post<T>("/payments/submit-verification", formData),
};
