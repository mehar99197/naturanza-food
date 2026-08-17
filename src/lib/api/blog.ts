/** Blog endpoints — public reads plus the admin editor's writes. */

import { apiClient } from "./client";
import type { QueryParams, RequestBody } from "./types";

export const blogAPI = {
  /** GET /blog */
  getPosts: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/blog", { params }),

  /** GET /blog/:slug */
  getPostBySlug: <T = unknown>(slug: string): Promise<T> =>
    apiClient.get<T>(`/blog/${encodeURIComponent(slug)}`),

  /** GET /blog/admin — includes drafts. */
  getAllAdmin: <T = unknown>(): Promise<T> => apiClient.get<T>("/blog/admin"),

  /** POST /blog */
  create: <T = unknown>(postData: RequestBody): Promise<T> =>
    apiClient.post<T>("/blog", postData),

  /** PUT /blog/:id */
  update: <T = unknown>(id: string | number, postData: RequestBody): Promise<T> =>
    apiClient.put<T>(`/blog/${id}`, postData),

  /** DELETE /blog/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/blog/${id}`),

  /** POST /blog/upload-image (multipart field `blog_image`). */
  uploadImage: <T = unknown>(file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("blog_image", file);
    return apiClient.post<T>("/blog/upload-image", formData);
  },
};
