const DEFAULT_BASE_CURRENCY = "PKR";

const FALLBACK_RATES = {
  PKR: 1,
  USD: 0.0036,
  EUR: 0.0033,
  GBP: 0.0028,
  INR: 0.30,
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

let exchangeState = {
  base: DEFAULT_BASE_CURRENCY,
  rates: { ...FALLBACK_RATES },
  updatedAt: null,
};

const normalizeCurrencyCode = (value) =>
  String(value || "").trim().toUpperCase();

export const setExchangeRates = (payload = {}) => {
  const rawRates = payload && typeof payload.rates === "object" ? payload.rates : {};
  const rates = {};

  Object.entries(rawRates).forEach(([code, value]) => {
    const normalized = normalizeCurrencyCode(code);
    const numeric = Number(value);
    if (normalized && Number.isFinite(numeric)) {
      rates[normalized] = numeric;
    }
  });

  rates[DEFAULT_BASE_CURRENCY] = 1;

  exchangeState = {
    base: DEFAULT_BASE_CURRENCY,
    rates,
    updatedAt: payload.updatedAt || null,
  };
};

export const getExchangeRate = (currency) => {
  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  const rate = exchangeState.rates?.[normalized];
  return Number.isFinite(rate) ? rate : null;
};

export const hasExchangeRate = (currency) => {
  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  return normalized === DEFAULT_BASE_CURRENCY || Number.isFinite(getExchangeRate(normalized));
};

export const convertFromPkr = (amount, currency) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = normalizeCurrencyCode(currency) || DEFAULT_BASE_CURRENCY;
  if (normalized === DEFAULT_BASE_CURRENCY) {
    return value;
  }

  const rate = getExchangeRate(normalized);
  if (!Number.isFinite(rate)) {
    return null;
  }

  return value * rate;
};

export const getExchangeRatesUpdatedAt = () => exchangeState.updatedAt;
