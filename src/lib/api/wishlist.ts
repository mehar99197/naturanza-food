/**
 * Wishlist endpoints.
 *
 * There are two removal paths and both take a PRODUCT id, not a wishlist row id.
 * routes/wishlist.js declares `DELETE /:product_id` and
 * `DELETE /remove/:productId` and routes them to the same handler, keyed on the
 * product either way. They are kept as two methods only because both call sites
 * exist in the current UI — `remove` and `removeByProduct` are interchangeable.
 */

import { apiClient } from "./client";

export const wishlistAPI = {
  /** GET /wishlist */
  get: <T = unknown>(): Promise<T> => apiClient.get<T>("/wishlist"),

  /** POST /wishlist/add */
  add: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.post<T>("/wishlist/add", { product_id: productId }),

  /** DELETE /wishlist/:product_id */
  remove: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.delete<T>(`/wishlist/${productId}`),

  /** DELETE /wishlist/remove/:productId */
  removeByProduct: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.delete<T>(`/wishlist/remove/${productId}`),

  /** GET /wishlist/check/:productId */
  check: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.get<T>(`/wishlist/check/${productId}`),

  /** DELETE /wishlist */
  clear: <T = unknown>(): Promise<T> => apiClient.delete<T>("/wishlist"),
};
