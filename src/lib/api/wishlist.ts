/**
 * Wishlist endpoints.
 *
 * Note the two removal paths: `DELETE /wishlist/:id` takes a wishlist row id
 * while `DELETE /wishlist/remove/:productId` takes a product id. Both exist on
 * the server and both are called from the UI, so both are kept.
 */

import { apiClient } from "./client";

export const wishlistAPI = {
  /** GET /wishlist */
  get: <T = unknown>(): Promise<T> => apiClient.get<T>("/wishlist"),

  /** POST /wishlist/add */
  add: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.post<T>("/wishlist/add", { product_id: productId }),

  /** DELETE /wishlist/:id */
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
