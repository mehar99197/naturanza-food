/** About-page content: one public read, one authenticated read, one write. */

import { apiClient } from "./client";
import type { RequestBody } from "./types";

export const aboutAPI = {
  /** GET /about — storefront copy. */
  getContent: <T = unknown>(): Promise<T> => apiClient.get<T>("/about"),

  /** GET /admin/about — the same content behind the admin gate. */
  getAdminContent: <T = unknown>(): Promise<T> => apiClient.get<T>("/admin/about"),

  /** PUT /admin/about */
  updateContent: <T = unknown>(content: RequestBody): Promise<T> =>
    apiClient.put<T>("/admin/about", content),

  /**
   * POST /blog/upload-image (multipart field `blog_image`).
   *
   * Deliberately reuses the blog uploader for the story image — it already
   * returns `{ imageUrl }` and writes to the same persistent-uploads directory,
   * so a second endpoint would only duplicate the sharp/WebP pipeline.
   */
  uploadImage: <T = unknown>(file: File | Blob): Promise<T> => {
    const formData = new FormData();
    formData.append("blog_image", file);
    return apiClient.post<T>("/blog/upload-image", formData);
  },
};
