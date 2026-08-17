/** Public store settings — no authentication on any of these. */

import { apiClient } from "./client";
import type { QueryParams } from "./types";

export const settingsAPI = {
  /** GET /settings */
  getPublicSettings: <T = unknown>(): Promise<T> => apiClient.get<T>("/settings"),

  /** GET /settings/contact */
  getContactSettings: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/settings/contact"),

  /** GET /settings/whatsapp */
  getWhatsAppNumber: <T = unknown>(): Promise<T> =>
    apiClient.get<T>("/settings/whatsapp"),

  /**
   * GET /settings/rates
   *
   * An empty list omits `params` entirely rather than sending `currencies=`,
   * which is how the server is asked for every rate it has.
   */
  getExchangeRates: <T = unknown>(
    currencies: readonly string[] = [],
  ): Promise<T> => {
    const params: QueryParams | undefined =
      Array.isArray(currencies) && currencies.length
        ? { currencies: currencies.join(",") }
        : undefined;
    return apiClient.get<T>("/settings/rates", params ? { params } : {});
  },
};
