"use client";

/**
 * Store settings and live exchange rates, ported from
 * `frontend/src/context/SettingsContext.jsx`.
 *
 * Both polls (settings every 30s, rates every 10min, each also refreshing on
 * window focus) and every dependency array are unchanged — the settings poll is
 * how an admin's price or discount edit reaches an open storefront tab.
 *
 * ADMIN SESSION: the source read `isAdminAuthenticated` from AdminAuthContext,
 * which is a later migration phase. Rather than delete the admin branches, they
 * are driven by two optional props that default to the storefront's values, so
 * an unauthenticated visitor gets byte-identical behaviour today and the admin
 * phase is a one-line wire-up. See {@link SettingsProviderProps}.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { isRecord } from "@/lib/api/errors";
import { geolocationAPI } from "@/lib/api/geolocation";
import { settingsAPI } from "@/lib/api/settings";
import {
  hasExchangeRate,
  setExchangeRates as setExchangeRatesStore,
} from "@/lib/exchangeRates";
import { safeLocalStorage } from "@/lib/storage";

import { apiErrorText, errorText } from "./apiErrors";
import {
  CURRENCY_STORAGE_KEY,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_SETTINGS,
  EXCHANGE_RATE_POLL_INTERVAL_MS,
  normalizeExchangeRates,
  normalizeSettings,
  SETTINGS_POLL_INTERVAL_MS,
  type ExchangeRatesState,
  type RefreshOptions,
  type SettingsContextValue,
  type SettingsInput,
  type SettingsProviderProps,
  type StoreSettings,
} from "./settingsHelpers";

export type {
  ExchangeRatesState,
  RefreshOptions,
  SettingsContextValue,
  SettingsInput,
  SettingsProviderProps,
  StoreSettings,
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

/**
 * Re-runs `refresh({ silent: true })` on an interval and on window focus.
 *
 * The source wrote this out twice, once per poll, and both copies were
 * identical apart from the interval. Behaviour is unchanged: the `window` guard
 * is redundant inside an effect but is kept from the source, `intervalMs` is a
 * module constant so it never re-keys the effect, and the effect is still
 * rebuilt whenever `refresh` changes identity — which is how a change of admin
 * session swaps the endpoint the poll hits.
 */
const useSilentPoll = (
  refresh: (options: RefreshOptions) => Promise<void>,
  intervalMs: number,
): void => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      void refresh({ silent: true });
    }, intervalMs);

    const handleFocus = () => {
      void refresh({ silent: true });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh, intervalMs]);
};

export function SettingsProvider({
  children,
  isAdminAuthenticated = false,
  loadAdminSettings,
}: SettingsProviderProps) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesState>(
    DEFAULT_EXCHANGE_RATES,
  );
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
  const [exchangeRatesError, setExchangeRatesError] = useState("");

  // Held in a ref so an inline prop cannot re-key `refreshSettings` and turn
  // the 30s poll into a fetch on every render.
  const loadAdminSettingsRef = useRef(loadAdminSettings);
  loadAdminSettingsRef.current = loadAdminSettings;

  const applySettings = useCallback(
    (payload: SettingsInput) => {
      if (isAdminAuthenticated) {
        setSettings(normalizeSettings(payload));
        return;
      }

      setSettings((prev) =>
        normalizeSettings({
          ...payload,
          currency: prev.currency || DEFAULT_SETTINGS.currency,
        }),
      );
    },
    [isAdminAuthenticated],
  );

  const applyExchangeRates = useCallback((payload: unknown) => {
    const normalized = normalizeExchangeRates(payload);
    setExchangeRates(normalized);
    setExchangeRatesStore(normalized);
  }, []);

  const refreshSettings = useCallback(
    async ({ silent = false }: RefreshOptions = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const adminLoader = loadAdminSettingsRef.current;
        const response =
          isAdminAuthenticated && adminLoader
            ? await adminLoader()
            : await settingsAPI.getPublicSettings<SettingsInput>();

        // Merge dedicated public contact fields so the rest of the app still has
        // access to phone, address, hours, and map data without exposing them on
        // the generic /settings endpoint.
        let contactResponse: SettingsInput = {};
        if (!isAdminAuthenticated) {
          try {
            contactResponse =
              await settingsAPI.getContactSettings<SettingsInput>();
          } catch {
            // Non-fatal; contact defaults already exist in DEFAULT_SETTINGS.
          }
        }

        applySettings({ ...response, ...contactResponse });
        setError("");
      } catch (requestError) {
        if (!silent) {
          setError(errorText(requestError) || "Failed to load settings");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [applySettings, isAdminAuthenticated],
  );

  const refreshExchangeRates = useCallback(
    async ({ silent = false }: RefreshOptions = {}) => {
      try {
        if (!silent) {
          setExchangeRatesLoading(true);
        }

        const response = await settingsAPI.getExchangeRates();
        applyExchangeRates(response);
        setExchangeRatesError("");
      } catch (requestError) {
        if (!silent) {
          setExchangeRatesError(
            apiErrorText(requestError) ||
              errorText(requestError) ||
              "Failed to load exchange rates",
          );
        }
      } finally {
        if (!silent) {
          setExchangeRatesLoading(false);
        }
      }
    },
    [applyExchangeRates],
  );

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    void refreshExchangeRates();
  }, [refreshExchangeRates]);

  useSilentPoll(refreshSettings, SETTINGS_POLL_INTERVAL_MS);
  useSilentPoll(refreshExchangeRates, EXCHANGE_RATE_POLL_INTERVAL_MS);

  const geoDetected = useRef(false);

  // No manual currency switcher: currency is purely auto-detected from the
  // visitor's location. Clear any legacy saved preference so it can't pin the
  // currency away from the detected one.
  useEffect(() => {
    if (typeof window !== "undefined") {
      safeLocalStorage.removeItem(CURRENCY_STORAGE_KEY);
    }
  }, []);

  // Auto-detect the visitor's currency by IP/location and convert from the PKR
  // base. Falls back to PKR (the store default) on any failure.
  useEffect(() => {
    if (geoDetected.current || isAdminAuthenticated) return;
    if (!exchangeRates.updatedAt && !settings.storeName) return;

    const detectCurrency = async () => {
      try {
        const data = await geolocationAPI.getCurrency();
        const rawCurrency = isRecord(data) ? data.currency : undefined;
        const detected = (
          rawCurrency ? String(rawCurrency) : "PKR"
        ).toUpperCase();
        if (detected !== "PKR" && hasExchangeRate(detected)) {
          setSettings((prev) => {
            if (prev.currency === detected) return prev;
            return normalizeSettings({ ...prev, currency: detected });
          });
        }
      } catch {
        // Ignore geolocation errors — fall back to store default (PKR)
      } finally {
        geoDetected.current = true;
      }
    };

    void detectCurrency();
  }, [exchangeRates.updatedAt, settings.storeName, isAdminAuthenticated]);

  const updateSettings = (newSettings: SettingsInput) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        exchangeRates,
        exchangeRatesLoading,
        exchangeRatesError,
        updateSettings,
        resetSettings,
        refreshSettings,
        refreshExchangeRates,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
