/** IP-based currency and country detection. */

import { apiClient } from "./client";

export interface GeolocationCurrency {
  country_code: string;
  currency: string;
  source: string;
}

/**
 * The shape returned when the lookup fails. Pakistan/PKR is the store's home
 * market, so falling back to it keeps prices readable rather than blank.
 */
const CURRENCY_FALLBACK: GeolocationCurrency = {
  country_code: "PK",
  currency: "PKR",
  source: "fallback",
};

export const geolocationAPI = {
  /**
   * GET /geolocation/currency
   *
   * Never rejects: a failed geo lookup must not stop a page rendering, so the
   * fallback is returned instead.
   */
  getCurrency: async (): Promise<GeolocationCurrency | unknown> => {
    try {
      return await apiClient.get<unknown>("/geolocation/currency");
    } catch {
      return { ...CURRENCY_FALLBACK };
    }
  },

  /** GET /geolocation/info — rejects normally, unlike `getCurrency`. */
  getInfo: <T = unknown>(): Promise<T> => apiClient.get<T>("/geolocation/info"),
};
