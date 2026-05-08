import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminAPI, settingsAPI } from '@/services/api';
import { useAdminAuth } from '@/context/AdminAuthContext';

const SettingsContext = createContext();
const SETTINGS_POLL_INTERVAL_MS = 30000;

const DEFAULT_SETTINGS = {
 storeName: 'Naturanza',
 storeEmail: 'support@naturanza.com',
 storePhone: '+92 (300) 123-4567',
 currency: 'PKR',
 taxRate: '18',
 shippingFlat: '250',
 shippingFree: '5000',
 emailNotifications: true,
 orderNotifications: true,
 lowStockAlerts: true
};

const normalizeSettings = (payload = {}) => {
	const next = { ...DEFAULT_SETTINGS, ...(payload || {}) };

	return {
		...next,
		taxRate: String(next.taxRate ?? DEFAULT_SETTINGS.taxRate),
		shippingFlat: String(next.shippingFlat ?? DEFAULT_SETTINGS.shippingFlat),
		shippingFree: String(next.shippingFree ?? DEFAULT_SETTINGS.shippingFree),
		emailNotifications: Boolean(next.emailNotifications),
		orderNotifications: Boolean(next.orderNotifications),
		lowStockAlerts: Boolean(next.lowStockAlerts),
	};
};

export function SettingsProvider({ children }) {
 const { isAdminAuthenticated } = useAdminAuth();
 const [settings, setSettings] = useState(DEFAULT_SETTINGS);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 const applySettings = useCallback((payload) => {
 setSettings(normalizeSettings(payload));
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

 useEffect(() => {
 void refreshSettings();
 }, [refreshSettings]);

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
 updateSettings, 
 resetSettings,
 refreshSettings,
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
