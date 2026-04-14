import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

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

export function SettingsProvider({ children }) {
 const [settings, setSettings] = useState(DEFAULT_SETTINGS);

 const updateSettings = (newSettings) => {
 setSettings(newSettings);
 };

 const resetSettings = () => {
 setSettings(DEFAULT_SETTINGS);
 };

 return (
 <SettingsContext.Provider value={{ 
 settings, 
 updateSettings, 
 resetSettings
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
