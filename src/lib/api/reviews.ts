/** Customer-facing review endpoints. */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const reviewAPI = {
  /** POST /reviews */
  submitReview: <T = unknown>(reviewData: RequestBody): Promise<T> =>
    apiClient.post<T>("/reviews", reviewData),

  /** GET /reviews/product/:id — approved reviews only. */
  getProductReviews: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.get<T>(`/reviews/product/${productId}`),

  /** GET /reviews/my-reviews */
  getMyReviews: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/reviews/my-reviews"),
};
