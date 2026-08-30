/**
 * Currency conversion table, ported from frontend/src/lib/exchangeRates.js.
 *
 * Rates are expressed per 1 PKR — PKR is the base and is always pinned to 1.
 * An unknown currency converts to `null` rather than silently falling back to
 * the PKR figure, so a caller can tell "no rate" apart from "no conversion
 * needed" and never shows a rupee amount labelled as dollars.
 *
 * ⚠ MODULE-LEVEL MUTABLE STATE. In the Vite SPA this lived in one browser tab.
 * Under Next this module is also evaluated on the server, where the state is
 * per *process* and therefore shared by every concurrent request. Call
 * `setExchangeRates` from client code only (a provider or effect) — never
 * during server rendering, or one visitor's rates become everyone's.
 */

const DEFAULT_BASE_CURRENCY = "PKR";

/** Currency code -> units of that currency per 1 PKR. */
export type ExchangeRateMap = Record<string, number>;

/**
 * Compiled-in rates used until the server sends live ones. They are stale by
 * construction; `getExchangeRatesUpdatedAt()` returns null while these are in
 * play so the UI can say so.
 */
const FALLBACK_RATES: ExchangeRateMap = {
  PKR: 1,
  USD: 0.0036,
  EUR: 0.0033,
  GBP: 0.0028,
  INR: 0.3,
  AED: 0.013,
  SAR: 0.013,
  CAD: 0.0049,
  AUD: 0.0055,
  JPY: 0.53,
  CNY: 0.026,
  BDT: 0.42,
  MYR: 0.017,
  SGD: 0.0048,
  THB: 0.13,
};

interface ExchangeState {
  base: string;
  rates: ExchangeRateMap;
  updatedAt: string | null;
}

let exchangeState: ExchangeState = {
  base: DEFAULT_BASE_CURRENCY,
  rates: { ...FALLBACK_RATES },
  updatedAt: null,
};

const normalizeCurrencyCode = (value: string | null | undefined): string =>
  String(value || "")
    .trim()
    .toUpperCase();

export interface ExchangeRatesPayload {
  /** Currency code -> rate per 1 PKR. Values are coerced with `Number()`. */
  rates?: Record<string, unknown> | null;
  updatedAt?: string | null;
}

/**
 * Replaces the whole rate table with what the server sent.
 *
 * Note this *replaces* rather than merges: a payload carrying only USD leaves
 * every other currency without a rate, and `hasExchangeRate` starts returning
 * false for them. That is deliberate — a partial payload means the server no
 * longer quotes those currencies, and falling back to the compiled-in table
 * would quote a price from stale constants.
 */
export const setExchangeRates = (payload: ExchangeRatesPayload = {}): void => {
  // `exchangeState` is module-level. Under Vite that meant "per browser tab";
  // under Next the server module is shared by the whole process, so writing to
  // it during SSR would set one visitor's rates for every other visitor served
  // by that worker. Reads stay available everywhere — only the mutation is
  // refused, and loudly, because the failure it prevents is silent and would
  // show customers prices quoted from someone else's currency.
  if (typeof window === "undefined") {
    throw new Error(
      "setExchangeRates must be called from client code only. On the server this " +
        "module's state is shared across every visitor handled by the worker.",
    );
  }

  // Preserved from the JS as-is, `typeof null === "object"` hole included: a
  // payload of `{ rates: null }` reaches Object.entries(null) and throws.
  // Callers pass either a rates object or nothing, so it has never fired. Left
  // unfixed so this and the Vite implementation stay byte-for-byte equivalent.
  const rawRates: unknown =
    payload && typeof payload.rates === "object" ? payload.rates : {};
  const rates: ExchangeRateMap = {};

  Object.entries(rawRates as Record<string, unknown>).forEach(
    ([code, value]) => {
      const normalized = normalizeCurrencyCode(code);
      const numeric = Number(value);
      if (normalized && Number.isFinite(numeric)) {
        rates[normalized] = numeric;
      }
    },
  );

  rates[DEFAULT_BASE_CURRENCY] = 1;

  exchangeState = {
    base: DEFAULT_BASE_CURRENCY,
    rates,
    updatedAt: payload.updatedAt || null,
  };
};

/** The rate for a currency, or null when none is known. */
export const getExchangeRate = (
  currency: string | null | undefined,
): number | null => {
  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  const rate = exchangeState.rates[normalized];
  // `typeof rate === "number"` only satisfies noUncheckedIndexedAccess; for a
  // `number | undefined` it decides exactly what Number.isFinite alone decided.
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
};

/** Whether a price can be quoted in this currency at all. */
export const hasExchangeRate = (
  currency: string | null | undefined,
): boolean => {
  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  const rate = getExchangeRate(normalized);
  return (
    normalized === DEFAULT_BASE_CURRENCY ||
    (rate !== null && Number.isFinite(rate))
  );
};

/**
 * Converts a PKR amount into `currency`.
 *
 * Returns null when the amount is not a finite number or the currency has no
 * rate. Note `Number(null)` is 0, so a null amount converts to 0 rather than
 * null — matching the original.
 */
export const convertFromPkr = (
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): number | null => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  if (normalized === DEFAULT_BASE_CURRENCY) {
    return value;
  }

  const rate = getExchangeRate(normalized);
  if (rate === null || !Number.isFinite(rate)) {
    return null;
  }

  return value * rate;
};

/** When the live rates were published, or null while the fallbacks are in use. */
export const getExchangeRatesUpdatedAt = (): string | null =>
  exchangeState.updatedAt;
