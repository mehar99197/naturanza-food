import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { adminAPI, settingsAPI, geolocationAPI } from '@/services/api';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { setExchangeRates as setExchangeRatesStore, hasExchangeRate } from '@/lib/exchangeRates';

const SettingsContext = createContext();
const SETTINGS_POLL_INTERVAL_MS = 30000;
const EXCHANGE_RATE_POLL_INTERVAL_MS = 1000 * 60 * 10;
const CURRENCY_STORAGE_KEY = 'naturanza_currency';

const DEFAULT_SETTINGS = {
 storeName: 'Naturanza',
 storeEmail: 'support@naturanzafood.com',
 storePhone: '+92340 9502646',
 currency: 'PKR',
 taxRate: '18',
 shippingFlat: '250',
 shippingFree: '5000',
 emailNotifications: true,
 orderNotifications: true,
 lowStockAlerts: true,
 address: 'Pakistan',
 supportHours: 'Available 24/7',
 facebookUrl: '',
 instagramUrl: '',
 twitterUrl: '',
 youtubeUrl: '',
 whatsappNumber: '',
 whatsappEnabled: true,
 mapLatitude: 31.5204,
 mapLongitude: 74.3587,
 mapLocationLabel: 'Pakistan, Lahore',
};

const DEFAULT_EXCHANGE_RATES = {
  base: 'PKR',
  rates: {
    PKR: 1, USD: 0.0036, EUR: 0.0033, GBP: 0.0028, INR: 0.30,
    AED: 0.013, SAR: 0.013, CAD: 0.0049, AUD: 0.0055, JPY: 0.53,
    CNY: 0.026, BDT: 0.42, MYR: 0.017, SGD: 0.0048, THB: 0.13,
  },
  updatedAt: Date.now(),
};

const normalizeCurrency = (value) =>
  String(value || DEFAULT_SETTINGS.currency).trim().toUpperCase() || DEFAULT_SETTINGS.currency;

const normalizeSettings = (payload = {}) => {
  const next = { ...DEFAULT_SETTINGS, ...(payload || {}) };

  return {
    ...next,
    currency: normalizeCurrency(next.currency),
    taxRate: String(next.taxRate ?? DEFAULT_SETTINGS.taxRate),
    shippingFlat: String(next.shippingFlat ?? DEFAULT_SETTINGS.shippingFlat),
    shippingFree: String(next.shippingFree ?? DEFAULT_SETTINGS.shippingFree),
    emailNotifications: Boolean(next.emailNotifications),
    orderNotifications: Boolean(next.orderNotifications),
    lowStockAlerts: Boolean(next.lowStockAlerts),
    address: String(next.address ?? DEFAULT_SETTINGS.address),
    supportHours: String(next.supportHours ?? DEFAULT_SETTINGS.supportHours),
    facebookUrl: String(next.facebookUrl ?? ''),
    instagramUrl: String(next.instagramUrl ?? ''),
    twitterUrl: String(next.twitterUrl ?? ''),
    youtubeUrl: String(next.youtubeUrl ?? ''),
    whatsappNumber: String(next.whatsappNumber ?? ''),
    whatsappEnabled: Boolean(next.whatsappEnabled),
    mapLatitude: Number.isFinite(Number(next.mapLatitude))
      ? Number(next.mapLatitude)
      : DEFAULT_SETTINGS.mapLatitude,
    mapLongitude: Number.isFinite(Number(next.mapLongitude))
      ? Number(next.mapLongitude)
      : DEFAULT_SETTINGS.mapLongitude,
    mapLocationLabel: String(next.mapLocationLabel ?? DEFAULT_SETTINGS.mapLocationLabel),
  };
};

const normalizeExchangeRates = (payload = {}) => {
 const rawRates = payload && typeof payload.rates === 'object' ? payload.rates : {};
 const rates = {};

 Object.entries(rawRates).forEach(([code, value]) => {
 const normalized = String(code || '').trim().toUpperCase();
 const numeric = Number(value);
 if (normalized && Number.isFinite(numeric)) {
 rates[normalized] = numeric;
 }
 });

 rates.PKR = 1;

 return {
 base: 'PKR',
 rates,
 updatedAt: payload.updatedAt || null,
 };
};

export function SettingsProvider({ children }) {
 const { isAdminAuthenticated } = useAdminAuth();
 const [settings, setSettings] = useState(DEFAULT_SETTINGS);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [exchangeRates, setExchangeRates] = useState(DEFAULT_EXCHANGE_RATES);
 const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
 const [exchangeRatesError, setExchangeRatesError] = useState('');

 const applySettings = useCallback((payload) => {
  if (isAdminAuthenticated) {
    setSettings(normalizeSettings(payload));
    return;
  }

  setSettings((prev) =>
    normalizeSettings({ ...payload, currency: prev.currency || DEFAULT_SETTINGS.currency }),
  );
 }, [isAdminAuthenticated]);

 const applyExchangeRates = useCallback((payload) => {
 const normalized = normalizeExchangeRates(payload);
 setExchangeRates(normalized);
 setExchangeRatesStore(normalized);
 }, []);

  const refreshSettings = useCallback(async ({ silent = false } = {}) => {
  try {
  if (!silent) {
  setLoading(true);
  }

  const response = isAdminAuthenticated
  ? await adminAPI.getSettings()
  : await settingsAPI.getPublicSettings();

  applySettings(response);
  setError('');
 } catch (requestError) {
 if (!silent) {
 setError(requestError?.message || 'Failed to load settings');
 }
 } finally {
 if (!silent) {
 setLoading(false);
 }
 }
 }, [applySettings, isAdminAuthenticated]);

 const refreshExchangeRates = useCallback(async ({ silent = false } = {}) => {
 try {
 if (!silent) {
 setExchangeRatesLoading(true);
 }

 const response = await settingsAPI.getExchangeRates();
 applyExchangeRates(response);
 setExchangeRatesError('');
 } catch (requestError) {
 if (!silent) {
 setExchangeRatesError(
 requestError?.response?.data?.error ||
 requestError?.message ||
 'Failed to load exchange rates',
 );
 }
 } finally {
 if (!silent) {
 setExchangeRatesLoading(false);
 }
 }
 }, [applyExchangeRates]);

 useEffect(() => {
 void refreshSettings();
 }, [refreshSettings]);

 useEffect(() => {
 void refreshExchangeRates();
 }, [refreshExchangeRates]);

 useEffect(() => {
 if (typeof window === 'undefined') {
 return undefined;
 }

 const timerId = window.setInterval(() => {
 void refreshSettings({ silent: true });
 }, SETTINGS_POLL_INTERVAL_MS);

 const handleFocus = () => {
 void refreshSettings({ silent: true });
 };

 window.addEventListener('focus', handleFocus);

 return () => {
 window.clearInterval(timerId);
 window.removeEventListener('focus', handleFocus);
 };
 }, [refreshSettings]);

 useEffect(() => {
 if (typeof window === 'undefined') {
 return undefined;
 }

 const timerId = window.setInterval(() => {
 void refreshExchangeRates({ silent: true });
 }, EXCHANGE_RATE_POLL_INTERVAL_MS);

 const handleFocus = () => {
 void refreshExchangeRates({ silent: true });
 };

 window.addEventListener('focus', handleFocus);

 return () => {
 window.clearInterval(timerId);
 window.removeEventListener('focus', handleFocus);
 };
  }, [refreshExchangeRates]);

  const geoDetected = useRef(false);
  // A user's explicit currency choice (from the switcher) overrides auto-detect.
  const manualCurrencyRef = useRef(null);

  // Apply a saved manual currency preference on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = normalizeCurrency(window.localStorage.getItem(CURRENCY_STORAGE_KEY) || '');
    if (!saved) return;
    manualCurrencyRef.current = saved;
    if (saved !== 'PKR') {
      setSettings((prev) => normalizeSettings({ ...prev, currency: saved }));
    }
  }, []);

  useEffect(() => {
    if (geoDetected.current || isAdminAuthenticated) return;
    // A saved manual choice wins — don't override it with geo-detection.
    if (manualCurrencyRef.current) {
      geoDetected.current = true;
      return;
    }
    if (!exchangeRates.updatedAt && !settings.storeName) return;

    const detectCurrency = async () => {
      try {
        const data = await geolocationAPI.getCurrency();
        const detected = String(data.currency || 'PKR').toUpperCase();
        if (detected !== 'PKR' && hasExchangeRate(detected)) {
          setSettings((prev) => {
            if (prev.currency === detected) return prev;
            return normalizeSettings({ ...prev, currency: detected });
          });
        }
      } catch {
        // Ignore geolocation errors — fall back to store default
      } finally {
        geoDetected.current = true;
      }
    };

    void detectCurrency();
  }, [exchangeRates.updatedAt, settings.storeName, isAdminAuthenticated]);

  // Manual currency override from the CurrencySwitcher. Persists the choice and
  // stops geo auto-detect from changing it. Pass 'PKR' to reset to the base.
  const setUserCurrency = useCallback((code) => {
    const normalized = normalizeCurrency(code);
    if (normalized !== 'PKR' && !hasExchangeRate(normalized)) return;
    manualCurrencyRef.current = normalized;
    geoDetected.current = true;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, normalized);
    }
    setSettings((prev) => normalizeSettings({ ...prev, currency: normalized }));
  }, []);

  const updateSettings = (newSettings) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
  setSettings(DEFAULT_SETTINGS);
  };

  return (
  <SettingsContext.Provider value={{ 
  settings, 
  loading,
  error,
  exchangeRates,
  exchangeRatesLoading,
  exchangeRatesError,
  updateSettings,
  setUserCurrency,
  resetSettings,
  refreshSettings,
  refreshExchangeRates,
  }}>
 {children}
 </SettingsContext.Provider>
 );
}

export function useSettings() {
 const context = useContext(SettingsContext);
 if (!context) {
 throw new Error('useSettings must be used within a SettingsProvider');
 }
 return context;
}
