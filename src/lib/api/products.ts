/**
 * Product catalog endpoints, plus the two review endpoints the product screens
 * reach for directly.
 */

import { apiClient } from "./client";
import { isRecord } from "./errors";
import { asList } from "./payload";
import type { QueryParamValue, RequestBody } from "./types";

const PRODUCT_PAGE_SIZE = 500;

/**
 * A catalog is bounded by the business in a way order history is not, and the
 * Shop page filters by category, price and search across the whole of it — so
 * loading it once is a deliberate choice, not the oversight the orders list was.
 * The ceiling exists so a runaway response can't hang the tab, and a truncated
 * catalog says so instead of silently showing a partial shop.
 */
const PRODUCT_FETCH_LIMIT = 5000;

export const productAPI = {
  /**
   * GET /products, walked page by page until a short page ends it.
   * Always resolves to a `{ data }` envelope regardless of what the server sent.
   */
  getAll: async <T = unknown>(
    includeInactive = false,
  ): Promise<{ data: T[] }> => {
    const allProducts: T[] = [];
    for (
      let offset = 0;
      offset < PRODUCT_FETCH_LIMIT;
      offset += PRODUCT_PAGE_SIZE
    ) {
      const payload = await apiClient.get<unknown>("/products", {
        params: {
          ...(includeInactive ? { includeInactive: "true" } : {}),
          limit: PRODUCT_PAGE_SIZE,
          offset,
        },
      });
      const page = asList<T>(payload);
      allProducts.push(...page);
      if (page.length < PRODUCT_PAGE_SIZE) break;
    }

    if (allProducts.length >= PRODUCT_FETCH_LIMIT) {
      console.warn(
        `Catalog reached the ${PRODUCT_FETCH_LIMIT}-product client limit; the list shown is incomplete. ` +
          "Move the product screens to server-side pagination before growing past this.",
      );
    }

    return { data: allProducts };
  },

  /** POST /products/upload-image (multipart field `product_image`). */
  uploadImage: <T = unknown>(file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("product_image", file);
    return apiClient.post<T>("/products/upload-image", formData);
  },

  /** GET /products/:id */
  getById: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/products/${id}`),

  /** GET /products?category= */
  getByCategory: <T = unknown>(category: string): Promise<T> =>
    apiClient.get<T>("/products", { params: { category } }),

  /** GET /products?featured=true */
  getFeatured: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/products", { params: { featured: true } }),

  /**
   * Two calls: fetch the product, then re-query the catalog by its category.
   * Resolves to `[]` when the product lookup comes back empty.
   */
  getRelated: async (productId: string | number): Promise<unknown> => {
    const product = await productAPI.getById<unknown>(productId);
    if (!product) return [];
    // A product with no `category` leaves the param `undefined`, which the
    // serializer drops entirely — the same unfiltered `GET /products` axios
    // sent. Coercing it to "" here would change the request.
    const raw: unknown = isRecord(product) ? product.category : undefined;
    const category: QueryParamValue =
      raw === undefined || raw === null ? (raw as undefined | null) : String(raw);
    return apiClient.get<unknown>("/products", { params: { category } });
  },

  /** POST /products */
  create: <T = unknown>(productData: RequestBody): Promise<T> =>
    apiClient.post<T>("/products", productData),

  /** PUT /products/:id */
  update: <T = unknown>(id: string | number, productData: RequestBody): Promise<T> =>
    apiClient.put<T>(`/products/${id}`, productData),

  /** DELETE /products/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/products/${id}`),

  /** GET /reviews/product/:id */
  getReviews: <T = unknown>(productId: string | number): Promise<T> =>
    apiClient.get<T>(`/reviews/product/${productId}`),

  /** POST /reviews, with the product id folded into the body. */
  addReview: <T = unknown>(
    productId: string | number,
    reviewData: Record<string, unknown>,
  ): Promise<T> =>
    apiClient.post<T>("/reviews", { ...reviewData, product_id: productId }),
};
