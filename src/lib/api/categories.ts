/**
 * Category endpoints, with the short-lived read-through cache the source added.
 *
 * Categories are rendered by the header, the shop filters and most product
 * cards, so a page load used to fan out into a dozen identical requests. The
 * cache collapses those: a hit inside the TTL is served from memory, and
 * concurrent misses share one in-flight promise. Every write clears it whole.
 */

import { apiClient } from "./client";
import type { QueryParams, RequestBody } from "./types";

interface CacheEntry {
  data?: unknown;
  promise?: Promise<unknown>;
  timestamp: number;
}

const categoryCache = new Map<string, CacheEntry>();
const CATEGORY_CACHE_TTL_MS = 30_000;

/** Params are sorted so `{a,b}` and `{b,a}` are one cache entry, not two. */
const getCategoryCacheKey = (params: QueryParams): string =>
  JSON.stringify(
    Object.entries(params || {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );

export const categoryAPI = {
  /** GET /categories */
  getAll: async <T = unknown>(params: QueryParams = {}): Promise<T> => {
    const key = getCategoryCacheKey(params);
    const cached = categoryCache.get(key);
    if (cached?.data && Date.now() - cached.timestamp < CATEGORY_CACHE_TTL_MS) {
      return cached.data as T;
    }
    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }

    const promise = apiClient
      .get<T>("/categories", { params })
      .then((data) => {
        categoryCache.set(key, { data, timestamp: Date.now() });
        return data;
      })
      .catch((error: unknown) => {
        categoryCache.delete(key);
        throw error;
      });
    // timestamp 0 marks an entry that is still in flight: the TTL check above
    // can never treat it as a fresh hit, so only the `promise` branch sees it.
    categoryCache.set(key, { promise, timestamp: 0 });
    return promise;
  },

  /** GET /categories/:id */
  getById: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/categories/${id}`),

  /** POST /categories */
  create: async <T = unknown>(categoryData: RequestBody): Promise<T> => {
    const data = await apiClient.post<T>("/categories", categoryData);
    categoryCache.clear();
    return data;
  },

  /** PUT /categories/:id */
  update: async <T = unknown>(
    id: string | number,
    categoryData: RequestBody,
  ): Promise<T> => {
    const data = await apiClient.put<T>(`/categories/${id}`, categoryData);
    categoryCache.clear();
    return data;
  },

  /** DELETE /categories/:id */
  delete: async <T = unknown>(id: string | number): Promise<T> => {
    const data = await apiClient.delete<T>(`/categories/${id}`);
    categoryCache.clear();
    return data;
  },

  /** POST /categories/upload-image (multipart field `category_image`). */
  uploadImage: <T = unknown>(file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("category_image", file);
    return apiClient.post<T>("/categories/upload-image", formData);
  },
};
