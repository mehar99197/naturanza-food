import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useSettings } from '@/context/SettingsContext';
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
 const { settings: globalSettings, updateSettings } = useSettings();
 const [settings, setSettings] = useState(globalSettings);
 const [originalSettings, setOriginalSettings] = useState(globalSettings);
 const [errors, setErrors] = useState({});
 const [isSaving, setIsSaving] = useState(false);
 const [showSuccessToast, setShowSuccessToast] = useState(false);
 const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
 const [testEmailSending, setTestEmailSending] = useState(false);
 const [mobileSection, setMobileSection] = useState('store');

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
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 // Update global settings context
 updateSettings(settings);
 
 setOriginalSettings(settings);
 setIsSaving(false);
 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 };

 const handleReset = () => {
 if (confirm('Are you sure you want to reset all settings to defaults?')) {
 setSettings(DEFAULT_SETTINGS);
 setOriginalSettings(DEFAULT_SETTINGS);
 updateSettings(DEFAULT_SETTINGS);
 setErrors({});
 }
 };

 const handleTestEmail = async () => {
 setTestEmailSending(true);
 // Simulate sending test email
 await new Promise(resolve => setTimeout(resolve, 1500));
 setTestEmailSending(false);
 alert('Test email sent to ' + settings.storeEmail);
 };

 return (
 <AdminLayout>
 <div className="max-w-4xl mx-auto">
 {/* Success Toast */}
 {showSuccessToast && (
 <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 w-[calc(100%-1.5rem)] sm:w-auto max-w-md bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-2.5 sm:gap-3 animate-slide-in">
 <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
 <div>
 <p className="font-bold text-sm sm:text-base">Settings Saved!</p>
 <p className="text-xs sm:text-sm text-green-100">Your changes have been saved successfully</p>
 </div>
 </div>
 )}

 {/* Header */}
 <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
 <div>
 <h1 className="text-[2rem] sm:text-3xl font-bold text-gray-900 mb-1.5 sm:mb-2">Settings</h1>
 <p className="text-sm sm:text-base text-gray-600">Manage your store configuration and preferences</p>
 {hasUnsavedChanges && (
 <div className="flex items-center gap-2 mt-2 text-amber-600">
 <AlertCircle className="w-4 h-4" />
 <span className="text-sm font-semibold">You have unsaved changes</span>
 </div>
 )}
 </div>
 <button
 onClick={handleReset}
 className="inline-flex h-10 self-end items-center justify-center gap-1.5 rounded-lg border-2 border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
 >
 <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
 Reset to Defaults
 </button>
 </div>

 <section className="md:hidden mb-4">
 <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
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
 mobileSection === item.key ? 'bg-[#2a5f1e] text-white' : 'text-gray-600'
 }`}
 >
 {item.label}
 </button>
 ))}
 </div>
 </section>

 <div className="space-y-4 sm:space-y-6">
 {/* Store Information */}
 <div className={`${mobileSection !== 'store' ? 'hidden md:block' : 'block'} bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
 <Store className="w-5 h-5 text-green-600" />
 </div>
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Store Information</h2>
 </div>

 <div className="space-y-3 sm:space-y-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Store Name
 </label>
 <input
 type="text"
 value={settings.storeName}
 onChange={(e) => handleChange('storeName', e.target.value)}
 className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100"
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
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
 : 'border-gray-200 focus:border-green-500 focus:ring-green-100'
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
 className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Send className="w-4 h-4" />
 {testEmailSending ? 'Sending...' : 'Send Test Email'}
 </button>
 </div>

 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Store Phone
 </label>
 <input
 type="tel"
 value={settings.storePhone}
 onChange={(e) => handleChange('storePhone', e.target.value)}
 className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-4 ${
 errors.storePhone 
 ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
 : 'border-gray-200 focus:border-green-500 focus:ring-green-100'
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
 <div className={`${mobileSection !== 'currency' ? 'hidden md:block' : 'block'} bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
 <CreditCard className="w-5 h-5 text-green-600" />
 </div>
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Currency & Tax</h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Currency
 </label>
 <select
 value={settings.currency}
 onChange={(e) => handleChange('currency', e.target.value)}
 className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100"
 >
 <option value="PKR">PKR - Pakistani Rupee</option>
 <option value="USD">USD - US Dollar</option>
 <option value="EUR">EUR - Euro</option>
 <option value="GBP">GBP - British Pound</option>
 <option value="INR">INR - Indian Rupee</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
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
 : 'border-gray-200 focus:border-green-500 focus:ring-green-100'
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
 <div className={`${mobileSection !== 'shipping' ? 'hidden md:block' : 'block'} bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
 <Truck className="w-5 h-5 text-blue-600" />
 </div>
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shipping Settings</h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
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
 : 'border-gray-200 focus:border-green-500 focus:ring-green-100'
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
 <label className="block text-sm font-semibold text-gray-700 mb-2">
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
 : 'border-gray-200 focus:border-green-500 focus:ring-green-100'
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
 <div className={`${mobileSection !== 'notifications' ? 'hidden md:block' : 'block'} bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6`}>
 <div className="flex items-center gap-3 mb-3 sm:mb-6">
 <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
 <Bell className="w-5 h-5 text-purple-600" />
 </div>
 <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
 </div>

 <div className="space-y-3 sm:space-y-4">
 {[
 { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive email alerts for important events' },
 { key: 'orderNotifications', label: 'New Order Alerts', description: 'Get notified when new orders are placed' },
 { key: 'lowStockAlerts', label: 'Low Stock Alerts', description: 'Receive alerts when products are running low' }
 ].map((item) => (
 <div key={item.key} className="flex items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-gray-50 rounded-xl">
 <div className="min-w-0">
 <p className="font-semibold text-gray-900">{item.label}</p>
 <p className="text-sm text-gray-600 leading-snug">{item.description}</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings[item.key]}
 onChange={(e) => handleChange(item.key, e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after: peer-checked:bg-green-600"></div>
 </label>
 </div>
 ))}
 </div>
 </div>

 {/* Save Button */}
 <div className="sticky bottom-2 sm:bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border border-gray-200 sm:border-0 rounded-2xl sm:rounded-none p-3 sm:p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="text-sm text-gray-600">
 {hasUnsavedChanges ? (
 <span className="flex items-center gap-2 text-amber-600 font-semibold">
 <AlertCircle className="w-4 h-4" />
 Unsaved changes
 </span>
 ) : (
 <span className="flex items-center gap-2 text-green-600 font-semibold">
 <CheckCircle className="w-4 h-4" />
 All changes saved
 </span>
 )}
 </div>
 <button
 onClick={handleSave}
 disabled={isSaving || Object.keys(errors).length > 0 || !hasUnsavedChanges}
 className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[46px]"
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
