/**
 * Store settings: defaults, shapes and the two normalisers, ported from
 * `frontend/src/context/SettingsContext.jsx`.
 *
 * Every field is coerced on the way in because the settings table stores
 * everything as text — `taxRate` arrives as "18", `whatsappEnabled` as 0/1 —
 * and the UI binds these straight into inputs and arithmetic.
 */

import type { ReactNode } from "react";

import { isRecord } from "@/lib/api/errors";
import type { ExchangeRateMap } from "@/lib/exchangeRates";

import { asText } from "./apiErrors";

/** localStorage key for the legacy manual currency choice. Cleared on mount. */
export const CURRENCY_STORAGE_KEY = "naturanza_currency";

export const SETTINGS_POLL_INTERVAL_MS = 30000;
export const EXCHANGE_RATE_POLL_INTERVAL_MS = 1000 * 60 * 10;

/**
 * Store settings as the app holds them. The index signature passes through any
 * additional column `/settings` grows, which is what the source's spreads did.
 */
export interface StoreSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  currency: string;
  taxRate: string;
  shippingFlat: string;
  shippingFree: string;
  emailNotifications: boolean;
  orderNotifications: boolean;
  lowStockAlerts: boolean;
  address: string;
  supportHours: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  whatsappNumber: string;
  whatsappEnabled: boolean;
  mapLatitude: number;
  mapLongitude: number;
  mapLocationLabel: string;
  storeDiscountActive: boolean;
  storeDiscountPercentage: number;
  storeDiscountLabel: string;
  [key: string]: unknown;
}

/** An untyped settings payload — an API response or a partial UI update. */
export type SettingsInput = Record<string, unknown>;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Naturanza",
  storeEmail: "support@naturanzafood.com",
  storePhone: "+92340 9502646",
  currency: "PKR",
  taxRate: "18",
  shippingFlat: "250",
  shippingFree: "5000",
  emailNotifications: true,
  orderNotifications: true,
  lowStockAlerts: true,
  address: "Pakistan",
  supportHours: "Available 24/7",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  twitterUrl: "",
  youtubeUrl: "",
  whatsappNumber: "",
  whatsappEnabled: true,
  mapLatitude: 31.5204,
  mapLongitude: 74.3587,
  mapLocationLabel: "Pakistan, Lahore",
  storeDiscountActive: false,
  storeDiscountPercentage: 0,
  storeDiscountLabel: "Store Sale",
};

export interface ExchangeRatesState {
  base: string;
  rates: ExchangeRateMap;
  /**
   * ISO timestamp from the server, or the seed value below until the first
   * response lands.
   */
  updatedAt: string | number | null;
}

/**
 * Seed rates, used for the render before the first `/settings/rates` response.
 *
 * ⚠ `updatedAt: Date.now()` is module-scope and therefore non-deterministic: the
 * server evaluates it once and the browser again, so the two never match. It is
 * preserved from the source because changing it would be a behaviour change,
 * and nothing reads it except a truthiness check in the currency-detection
 * effect. Do not render `exchangeRates.updatedAt` before the first refresh
 * completes — that would be a hydration mismatch.
 */
export const DEFAULT_EXCHANGE_RATES: ExchangeRatesState = {
  base: "PKR",
  rates: {
    PKR: 1, USD: 0.0036, EUR: 0.0033, GBP: 0.0028, INR: 0.3,
    AED: 0.013, SAR: 0.013, CAD: 0.0049, AUD: 0.0055, JPY: 0.53,
    CNY: 0.026, BDT: 0.42, MYR: 0.017, SGD: 0.0048, THB: 0.13,
  },
  updatedAt: Date.now(),
};

export interface RefreshOptions {
  /** Suppresses the loading flag and error banner, for background polls. */
  silent?: boolean;
}

export interface SettingsContextValue {
  settings: StoreSettings;
  loading: boolean;
  error: string;
  exchangeRates: ExchangeRatesState;
  exchangeRatesLoading: boolean;
  exchangeRatesError: string;
  updateSettings: (newSettings: SettingsInput) => void;
  resetSettings: () => void;
  refreshSettings: (options?: RefreshOptions) => Promise<void>;
  refreshExchangeRates: (options?: RefreshOptions) => Promise<void>;
}

export interface SettingsProviderProps {
  children: ReactNode;
  /**
   * Whether an admin is signed in. Supply from AdminAuthProvider once it is
   * ported; until then the storefront value (false) is correct and selects the
   * public settings endpoint, exactly as a logged-out visitor always did.
   */
  isAdminAuthenticated?: boolean;
  /**
   * Loader for the authenticated settings endpoint (`adminAPI.getSettings`),
   * which is not ported yet. Must be supplied together with
   * `isAdminAuthenticated`; without it the public endpoint is used.
   */
  loadAdminSettings?: () => Promise<SettingsInput>;
}

/**
 * `String(value || DEFAULT).trim().toUpperCase() || DEFAULT` — written as a
 * conditional so a falsy non-null value still falls back to the default rather
 * than stringifying to "FALSE".
 */
export const normalizeCurrency = (value: unknown): string => {
  const source = value ? String(value) : DEFAULT_SETTINGS.currency;
  return source.trim().toUpperCase() || DEFAULT_SETTINGS.currency;
};

export const normalizeSettings = (payload: SettingsInput = {}): StoreSettings => {
  const next: SettingsInput = { ...DEFAULT_SETTINGS, ...(payload || {}) };

  return {
    ...next,
    // The source spread these three through untouched and coerced every other
    // string field. They are coerced here for the same reason the others were:
    // the settings table stores text, so this is a no-op on real payloads, and
    // it is what lets the result satisfy StoreSettings without a cast.
    storeName: String(next.storeName ?? DEFAULT_SETTINGS.storeName),
    storeEmail: String(next.storeEmail ?? DEFAULT_SETTINGS.storeEmail),
    storePhone: String(next.storePhone ?? DEFAULT_SETTINGS.storePhone),
    currency: normalizeCurrency(next.currency),
    taxRate: String(next.taxRate ?? DEFAULT_SETTINGS.taxRate),
    shippingFlat: String(next.shippingFlat ?? DEFAULT_SETTINGS.shippingFlat),
    shippingFree: String(next.shippingFree ?? DEFAULT_SETTINGS.shippingFree),
    emailNotifications: Boolean(next.emailNotifications),
    orderNotifications: Boolean(next.orderNotifications),
    lowStockAlerts: Boolean(next.lowStockAlerts),
    address: String(next.address ?? DEFAULT_SETTINGS.address),
    supportHours: String(next.supportHours ?? DEFAULT_SETTINGS.supportHours),
    facebookUrl: String(next.facebookUrl ?? ""),
    instagramUrl: String(next.instagramUrl ?? ""),
    tiktokUrl: String(next.tiktokUrl ?? ""),
    twitterUrl: String(next.twitterUrl ?? ""),
    youtubeUrl: String(next.youtubeUrl ?? ""),
    whatsappNumber: String(next.whatsappNumber ?? ""),
    whatsappEnabled: Boolean(next.whatsappEnabled),
    mapLatitude: Number.isFinite(Number(next.mapLatitude))
      ? Number(next.mapLatitude)
      : DEFAULT_SETTINGS.mapLatitude,
    mapLongitude: Number.isFinite(Number(next.mapLongitude))
      ? Number(next.mapLongitude)
      : DEFAULT_SETTINGS.mapLongitude,
    mapLocationLabel: String(
      next.mapLocationLabel ?? DEFAULT_SETTINGS.mapLocationLabel,
    ),
    storeDiscountActive: Boolean(next.storeDiscountActive),
    storeDiscountPercentage: Number.isFinite(Number(next.storeDiscountPercentage))
      ? Number(next.storeDiscountPercentage)
      : 0,
    storeDiscountLabel: String(
      next.storeDiscountLabel ?? DEFAULT_SETTINGS.storeDiscountLabel,
    ),
  };
};

/**
 * Rebuilds the rate table from a `/settings/rates` payload. PKR is pinned to 1
 * regardless of what the server sent.
 *
 * `updatedAt` is narrowed to a string here where the source passed the raw
 * value through. The endpoint sends an ISO string, and `setExchangeRates` in
 * @/lib/exchangeRates only accepts `string | null`; the sole reader of the
 * field is a truthiness test, so nothing observes the difference.
 */
export const normalizeExchangeRates = (
  payload: unknown,
): { base: string; rates: ExchangeRateMap; updatedAt: string | null } => {
  const record: SettingsInput = isRecord(payload) ? payload : {};
  // PRESERVED AS FOUND, `typeof null === "object"` hole included: a payload of
  // `{ rates: null }` reaches `Object.entries(null)` and throws, which the
  // caller's try/catch turns into an error banner while the previous rate table
  // stays in place. Narrowing with `isRecord` here would instead succeed and
  // replace every rate with PKR-only — silently unpricing every other currency.
  // Matches the same preserved hole in @/lib/exchangeRates.
  const rawRates: unknown =
    typeof record.rates === "object" ? record.rates : {};
  const rates: ExchangeRateMap = {};

  Object.entries(rawRates as Record<string, unknown>).forEach(([code, value]) => {
    const normalized = asText(code).trim().toUpperCase();
    const numeric = Number(value);
    if (normalized && Number.isFinite(numeric)) {
      rates[normalized] = numeric;
    }
  });

  rates.PKR = 1;

  const updatedAt = record.updatedAt;

  return {
    base: "PKR",
    rates,
    updatedAt: typeof updatedAt === "string" && updatedAt ? updatedAt : null,
  };
};
