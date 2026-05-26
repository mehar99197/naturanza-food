const DEFAULT_SUPPORTED_CURRENCIES = ["PKR", "USD", "EUR", "GBP", "INR", "AED", "SAR", "CAD", "AUD", "JPY", "CNY", "BDT", "MYR", "SGD", "THB"];
const CACHE_TTL_MS = Math.max(
  Number.parseInt(process.env.EXCHANGE_RATE_CACHE_MS || "600000", 10) || 600000,
  60000,
);

let cachedRates = null;
let inFlightPromise = null;

const normalizeCurrencyCode = (value) =>
  String(value || "").trim().toUpperCase();

const normalizeCurrencyList = (value) => {
  if (!value) {
    return [];
  }

  const rawList = Array.isArray(value) ? value : String(value).split(",");
  return rawList
    .map((entry) => normalizeCurrencyCode(entry))
    .filter(Boolean);
};

// Approximate PKR-based rates as last-resort fallback (updated Mar 2026)
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

const fetchFromFrankfurter = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD", {
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error("Frankfurter API request failed");
      error.code = "EXCHANGE_FALLBACK_FAILED";
      throw error;
    }

    const payload = await response.json();
    const rates = payload?.rates || {};

    return {
      base: "USD",
      rates,
      fetchedAt: Date.now(),
      updatedAt: payload.date
        ? new Date(payload.date).toISOString()
        : new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const fetchOpenExchangeRates = async () => {
  const appId = String(process.env.OPENEXCHANGE_APP_ID || "").trim();

  let response;
  if (appId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}`,
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const error = new Error("Failed to fetch exchange rates from OpenExchangeRates");
      error.code = "EXCHANGE_FETCH_FAILED";
      throw error;
    }
  } else {
    // Fall back to free Frankfurter API
    return fetchFromFrankfurter();
  }

  const payload = await response.json();
  const timestamp = Number(payload?.timestamp || 0);
  const rates = payload?.rates || {};

  return {
    base: normalizeCurrencyCode(payload?.base) || "USD",
    rates,
    fetchedAt: Date.now(),
    updatedAt: timestamp ? new Date(timestamp * 1000).toISOString() : null,
  };
};

const getOpenExchangeRates = async () => {
  const now = Date.now();
  if (cachedRates && now - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  if (!inFlightPromise) {
    inFlightPromise = fetchOpenExchangeRates()
      .then((data) => {
        cachedRates = data;
        return data;
      })
      .catch((error) => {
        // If fetch fails, return fallback rates
        if (error.code === "EXCHANGE_FETCH_FAILED" || error.code === "EXCHANGE_FALLBACK_FAILED") {
          const fallbackData = {
            base: "USD",
            rates: {},
            fetchedAt: Date.now(),
            updatedAt: new Date().toISOString(),
          };
          Object.entries(FALLBACK_RATES).forEach(([code, rate]) => {
            if (code !== "PKR") {
              fallbackData.rates[code] = rate / FALLBACK_RATES.USD;
            }
          });
          fallbackData.rates.PKR = 1 / FALLBACK_RATES.USD;
          fallbackData.rates.USD = 1;
          cachedRates = fallbackData;
          return fallbackData;
        }
        throw error;
      })
      .finally(() => {
        inFlightPromise = null;
      });
  }

  return inFlightPromise;
};

const getPkrExchangeRates = async (currencies = DEFAULT_SUPPORTED_CURRENCIES) => {
  const normalized = new Set(normalizeCurrencyList(currencies));
  normalized.add("PKR");

  const data = await getOpenExchangeRates();
  const ratePkr = Number(data?.rates?.PKR);

  if (!Number.isFinite(ratePkr) || ratePkr <= 0) {
    // Ultimate fallback: use hardcoded approximate rates
    const rates = { PKR: 1 };
    normalized.forEach((code) => {
      if (code !== "PKR" && FALLBACK_RATES[code]) {
        rates[code] = FALLBACK_RATES[code];
      }
    });
    return {
      base: "PKR",
      rates,
      updatedAt: new Date().toISOString(),
    };
  }

  const rates = { PKR: 1 };
  normalized.forEach((code) => {
    if (code === "PKR") {
      return;
    }

    const rawRate = Number(data?.rates?.[code]);
    if (Number.isFinite(rawRate)) {
      rates[code] = rawRate / ratePkr;
    }
  });

  return {
    base: "PKR",
    rates,
    updatedAt: data.updatedAt,
  };
};

module.exports = {
  DEFAULT_SUPPORTED_CURRENCIES,
  getPkrExchangeRates,
  normalizeCurrencyList,
};
