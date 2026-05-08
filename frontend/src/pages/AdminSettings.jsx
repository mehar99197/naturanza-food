import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useSettings } from '@/context/SettingsContext';
import { adminAPI } from '@/services/api';
import { 
 Store,
 Bell,
 CreditCard,
 Truck,
 Save,
 AlertCircle,
 CheckCircle,
 RotateCcw,
 Send
} from 'lucide-react';

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

export function AdminSettings() {
 const {
 settings: globalSettings,
 updateSettings,
 error: settingsError,
 } = useSettings();
 const [settings, setSettings] = useState(globalSettings);
 const [originalSettings, setOriginalSettings] = useState(globalSettings);
 const [errors, setErrors] = useState({});
 const [isSaving, setIsSaving] = useState(false);
 const [showSuccessToast, setShowSuccessToast] = useState(false);
 const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
 const [testEmailSending, setTestEmailSending] = useState(false);
 const [mobileSection, setMobileSection] = useState('store');

 useEffect(() => {
 if (!hasUnsavedChanges) {
 setSettings(globalSettings);
 setOriginalSettings(globalSettings);
 }
 }, [globalSettings, hasUnsavedChanges]);

 useEffect(() => {
 const isDifferent = JSON.stringify(settings) !== JSON.stringify(originalSettings);
 setHasUnsavedChanges(isDifferent);
 }, [settings, originalSettings]);

 const validateField = (field, value) => {
 const newErrors = { ...errors };

 switch (field) {
 case 'storeEmail':
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
 newErrors.storeEmail = 'Invalid email format';
 } else {
 delete newErrors.storeEmail;
 }
 break;
 case 'storePhone':
 if (!/^\+?[\d\s()-]+$/.test(value)) {
 newErrors.storePhone = 'Invalid phone format';
 } else {
 delete newErrors.storePhone;
 }
 break;
 case 'taxRate':
 if (parseFloat(value) < 0 || parseFloat(value) > 100) {
 newErrors.taxRate = 'Tax rate must be between 0 and 100';
 } else {
 delete newErrors.taxRate;
 }
 break;
 case 'shippingFlat':
 case 'shippingFree':
 if (parseFloat(value) < 0) {
 newErrors[field] = 'Must be a positive number';
 } else {
 delete newErrors[field];
 }
 break;
 }

 setErrors(newErrors);
 };

 const handleChange = (field, value) => {
 setSettings(prev => ({ ...prev, [field]: value }));
 validateField(field, value);
 };

 const handleSave = async () => {
 if (Object.keys(errors).length > 0) {
 return;
 }

 setIsSaving(true);
 try {
 const payload = {
 ...settings,
 taxRate: Number(settings.taxRate) || 0,
 shippingFlat: Number(settings.shippingFlat) || 0,
 shippingFree: Number(settings.shippingFree) || 0,
 };

 const savedSettings = await adminAPI.updateSettings(payload);
 updateSettings(savedSettings);
 setSettings(savedSettings);
 setOriginalSettings(savedSettings);
 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 } catch (error) {
 alert(error?.response?.data?.error || 'Failed to save settings');
 } finally {
 setIsSaving(false);
 }
 };

 const handleReset = () => {
 if (confirm('Are you sure you want to reset all settings to defaults?')) {
 (async () => {
 try {
 setIsSaving(true);
 const savedSettings = await adminAPI.updateSettings(DEFAULT_SETTINGS);
 updateSettings(savedSettings);
 setSettings(savedSettings);
 setOriginalSettings(savedSettings);
 setErrors({});
 } catch (error) {
 alert(error?.response?.data?.error || 'Failed to reset settings');
 } finally {
 setIsSaving(false);
 }
 })();
 }
 };

 const handleTestEmail = async () => {
 setTestEmailSending(true);
 try {
 const response = await adminAPI.sendTestEmail(settings.storeEmail);
 alert(response?.message || `Test email sent to ${settings.storeEmail}`);
 } catch (error) {
 alert(error?.response?.data?.error || 'Failed to send test email');
 } finally {
 setTestEmailSending(false);
 }
 };

 return (
 <AdminLayout>
 <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
 {/* Success Toast */}
 {showSuccessToast && (
 <div className="fixed top-4 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-emerald-700 px-4 py-3 text-white shadow-2xl sm:left-auto sm:right-4 sm:w-auto sm:translate-x-0 sm:gap-3 sm:px-6 sm:py-4 animate-slide-in">
 <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
 <div>
 <p className="font-bold text-sm sm:text-base">Settings Saved!</p>
 <p className="text-xs sm:text-sm text-green-100">Your changes have been saved successfully</p>
 </div>
 </div>
 )}

 {/* Header */}
 <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
 <div>
 <h1 className="mb-1.5 text-[2rem] font-bold text-slate-900 sm:mb-2 sm:text-3xl">Settings</h1>
 <p className="text-sm text-slate-600 sm:text-base">Manage your store configuration and preferences</p>
 {hasUnsavedChanges && (
 <div className="flex items-center gap-2 mt-2 text-amber-600">
 <AlertCircle className="w-4 h-4" />
 <span className="text-sm font-semibold">You have unsaved changes</span>
 </div>
 )}

 {settingsError ? (
 <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
 <AlertCircle className="w-5 h-5" />
 {settingsError}
 </div>
 ) : null}
 </div>
 <button
 onClick={handleReset}
 className="inline-flex h-10 self-end items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 sm:min-h-[42px] sm:w-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
 >
 <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
 Reset to Defaults
 </button>
 </div>

 <section className="mb-4 md:hidden">
 <div className="inline-flex rounded-full border border-emerald-100 bg-white p-1 shadow-sm">
 {[
 { key: 'store', label: 'Store' },
 { key: 'currency', label: 'Currency' },
 { key: 'shipping', label: 'Shipping' },
 { key: 'notifications', label: 'Notify' }
 ].map((item) => (
 <button
 key={item.key}
 type="button"
 onClick={() => setMobileSection(item.key)}
 className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
 mobileSection === item.key ? 'bg-emerald-700 text-white' : 'text-slate-600'
 }`}
 >
 {item.label}
 </button>
 ))}
 </div>
 </section>

 <div className="space-y-4 sm:space-y-6">
 {/* Store Information */}
 <div className={`${mobileSection !== 'store' ? 'hidden md:block' : 'block'} rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
 <Store className="w-5 h-5 text-green-600" />
 </div>
 <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Store Information</h2>
 </div>

 <div className="space-y-3 sm:space-y-4">
 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Store Name
 </label>
 <input
 type="text"
 value={settings.storeName}
 onChange={(e) => handleChange('storeName', e.target.value)}
 className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Store Email
 </label>
 <div className="relative">
 <input
 type="email"
 value={settings.storeEmail}
 onChange={(e) => handleChange('storeEmail', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.storeEmail 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100'
 }`}
 />
 {errors.storeEmail && (
 <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
 <AlertCircle className="w-4 h-4" />
 {errors.storeEmail}
 </div>
 )}
 </div>
 <button
 onClick={handleTestEmail}
 disabled={testEmailSending || errors.storeEmail}
 className="mt-2 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <Send className="w-4 h-4" />
 {testEmailSending ? 'Sending...' : 'Send Test Email'}
 </button>
 </div>

 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Store Phone
 </label>
 <input
 type="tel"
 value={settings.storePhone}
 onChange={(e) => handleChange('storePhone', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.storePhone 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100'
 }`}
 />
 {errors.storePhone && (
 <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
 <AlertCircle className="w-4 h-4" />
 {errors.storePhone}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Currency & Tax */}
 <div className={`${mobileSection !== 'currency' ? 'hidden md:block' : 'block'} rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
 <CreditCard className="w-5 h-5 text-green-600" />
 </div>
 <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Currency & Tax</h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Currency
 </label>
 <select
 value={settings.currency}
 onChange={(e) => handleChange('currency', e.target.value)}
 className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
 >
 <option value="PKR">PKR - Pakistani Rupee</option>
 <option value="USD">USD - US Dollar</option>
 <option value="EUR">EUR - Euro</option>
 <option value="GBP">GBP - British Pound</option>
 <option value="INR">INR - Indian Rupee</option>
 </select>
 </div>

 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Tax Rate (%)
 </label>
 <input
 type="number"
 step="0.1"
 value={settings.taxRate}
 onChange={(e) => handleChange('taxRate', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.taxRate 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100'
 }`}
 />
 {errors.taxRate && (
 <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
 <AlertCircle className="w-4 h-4" />
 {errors.taxRate}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Shipping Settings */}
 <div className={`${mobileSection !== 'shipping' ? 'hidden md:block' : 'block'} rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
 <Truck className="w-5 h-5 text-emerald-600" />
 </div>
 <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Shipping Settings</h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Flat Rate Shipping ($)
 </label>
 <input
 type="number"
 step="0.01"
 value={settings.shippingFlat}
 onChange={(e) => handleChange('shippingFlat', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.shippingFlat 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100'
 }`}
 />
 {errors.shippingFlat && (
 <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
 <AlertCircle className="w-4 h-4" />
 {errors.shippingFlat}
 </div>
 )}
 </div>

 <div>
 <label className="mb-2 block text-sm font-semibold text-slate-700">
 Free Shipping Above ($)
 </label>
 <input
 type="number"
 step="0.01"
 value={settings.shippingFree}
 onChange={(e) => handleChange('shippingFree', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.shippingFree 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-100'
 }`}
 />
 {errors.shippingFree && (
 <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
 <AlertCircle className="w-4 h-4" />
 {errors.shippingFree}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Notifications */}
 <div className={`${mobileSection !== 'notifications' ? 'hidden md:block' : 'block'} rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
 <Bell className="w-5 h-5 text-emerald-600" />
 </div>
 <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Notifications</h2>
 </div>

 <div className="space-y-3 sm:space-y-4">
 {[
 { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive email alerts for important events' },
 { key: 'orderNotifications', label: 'New Order Alerts', description: 'Get notified when new orders are placed' },
 { key: 'lowStockAlerts', label: 'Low Stock Alerts', description: 'Receive alerts when products are running low' }
 ].map((item) => (
 <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-[#f4faf5] p-3.5 sm:items-center sm:p-4">
 <div className="min-w-0">
 <p className="font-semibold text-slate-900">{item.label}</p>
 <p className="text-sm leading-snug text-slate-600">{item.description}</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings[item.key]}
 onChange={(e) => handleChange(item.key, e.target.checked)}
 className="sr-only peer"
 />
 <div className="h-6 w-11 rounded-full bg-gray-200 peer peer-checked:bg-emerald-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:content-['']"></div>
 </label>
 </div>
 ))}
 </div>
 </div>

 {/* Save Button */}
 <div className="mt-1 flex flex-col justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-3 sm:mt-2 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
 <div className="text-sm text-slate-600">
 {hasUnsavedChanges ? (
 <span className="flex items-center gap-2 text-amber-600 font-semibold">
 <AlertCircle className="w-4 h-4" />
 Unsaved changes
 </span>
 ) : (
 <span className="flex items-center gap-2 font-semibold text-emerald-600">
 <CheckCircle className="w-4 h-4" />
 All changes saved
 </span>
 )}
 </div>
 <button
 onClick={handleSave}
 disabled={isSaving || Object.keys(errors).length > 0 || !hasUnsavedChanges}
 className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-8 py-3 font-semibold text-white shadow-lg hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
 >
 {isSaving ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
 Saving...
 </>
 ) : (
 <>
 <Save className="w-5 h-5" />
 Save Changes
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </AdminLayout>
 );
}
