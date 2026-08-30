/** Server-side cart endpoints. All of them require a user session. */

import { apiClient } from "./client";

export const cartAPI = {
  /** GET /cart */
  get: <T = unknown>(): Promise<T> => apiClient.get<T>("/cart"),

  /** POST /cart/add */
  add: <T = unknown>(productId: string | number, quantity: number): Promise<T> =>
    apiClient.post<T>("/cart/add", { product_id: productId, quantity }),

  /** PUT /cart/update/:productId */
  update: <T = unknown>(
    productId: string | number,
    quantity: number,
  ): Promise<T> =>
    apiClient.put<T>(`/cart/update/${productId}`, { quantity }),

  /** DELETE /cart/remove/:productId */
  remove: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.delete<T>(`/cart/remove/${productId}`),

  /** DELETE /cart/clear */
  clear: <T = unknown>(): Promise<T> => apiClient.delete<T>("/cart/clear"),
};
