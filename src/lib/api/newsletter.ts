/** Newsletter: one public subscribe endpoint, the rest admin-only. */

import { apiClient } from "./client";
import type { QueryParams } from "./types";

export const newsletterAPI = {
  /** POST /newsletter/subscribe */
  subscribe: <T = unknown>(email: string, source = "footer"): Promise<T> =>
    apiClient.post<T>("/newsletter/subscribe", { email, source }),

  /** GET /admin/newsletter/subscribers */
  listSubscribers: <T = unknown>(params: QueryParams = {}): Promise<T> =>
    apiClient.get<T>("/admin/newsletter/subscribers", { params }),

  /** DELETE /admin/newsletter/subscribers/:id */
  deleteSubscriber: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/admin/newsletter/subscribers/${id}`),

  /** POST /admin/newsletter/broadcast */
  broadcast: <T = unknown>(payload: {
    subject: string;
    message: string;
  }): Promise<T> =>
    apiClient.post<T>("/admin/newsletter/broadcast", {
      subject: payload.subject,
      message: payload.message,
    }),

  /** POST /admin/newsletter/welcome-promo */
  setWelcomePromo: <T = unknown>(code: string): Promise<T> =>
    apiClient.post<T>("/admin/newsletter/welcome-promo", { code }),
};
