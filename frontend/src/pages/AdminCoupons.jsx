import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { useAdminData } from '@/context/AdminDataContext';
import { formatPrice } from '../lib/utils';
import { 
  AlertCircle, 
  TrendingUp, 
  Users, 
  Percent, 
  X, 
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Pencil,
  Trash2,
  Ticket
} from 'lucide-react';

export default function AdminCoupons() {
 const { coupons, addCoupon, updateCoupon, deleteCoupon, toggleCouponStatus } = useAdminData();
 const [showForm, setShowForm] = useState(false);
 const [editingCoupon, setEditingCoupon] = useState(null);
 const [showSuccessToast, setShowSuccessToast] = useState(false);
 const [toastMessage, setToastMessage] = useState('');
 const [error, setError] = useState('');
 const [formData, setFormData] = useState({
 code: '',
 description: '',
 discount_type: 'percentage',
 discount_value: '',
 min_order_amount: '',
 max_discount: '',
 usage_limit: '',
 expiry_date: ''
 });

 const handleInputChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 
 // Validation
 if (!formData.code || !formData.discount_value) {
 setError('Please fill in required fields (Code and Discount Value)');
 return;
 }

 const payload = {
 ...formData,
 discount_value: parseFloat(formData.discount_value),
 min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : 0,
 max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
 usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
 expiry_date: formData.expiry_date || null
 };

 try {
 if (editingCoupon) {
 await updateCoupon(editingCoupon.id, payload);
 setToastMessage('Coupon updated successfully!');
 } else {
 await addCoupon(payload);
 setToastMessage('Coupon created successfully!');
 }

 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 resetForm();
 } catch (error) {
 setError('Error: ' + (error.response?.data?.error || 'Failed to save coupon'));
 }
 };

 const handleEdit = (coupon) => {
 setEditingCoupon(coupon);
 setFormData({
 code: coupon.code,
 description: coupon.description || '',
 discount_type: coupon.discount_type,
 discount_value: coupon.discount_value,
 min_order_amount: coupon.min_order_amount || '',
 max_discount: coupon.max_discount || '',
 usage_limit: coupon.usage_limit || '',
 expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date).toISOString().split('T')[0] : ''
 });
 setShowForm(true);
 };

 const handleDelete = async (id) => {
 if (!confirm('Are you sure you want to delete this coupon?')) return;

 try {
 await deleteCoupon(id);
 setToastMessage('Coupon deleted successfully!');
 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 } catch (error) {
 setError('Error deleting coupon: ' + (error.response?.data?.error || 'Unknown error'));
 }
 };

 const toggleStatus = async (id) => {
 try {
 await toggleCouponStatus(id);
 } catch (error) {
 setError('Error toggling coupon status: ' + (error.response?.data?.error || 'Unknown error'));
 }
 };

 const resetForm = () => {
 setFormData({
 code: '',
 description: '',
 discount_type: 'percentage',
 discount_value: '',
 min_order_amount: '',
 max_discount: '',
 usage_limit: '',
 expiry_date: ''
 });
 setEditingCoupon(null);
 setShowForm(false);
 setError('');
 };

 const isExpired = (date) => {
 if (!date) return false;
 return new Date(date) < new Date();
 };

 // Calculate statistics
 const statistics = useMemo(() => {
 const totalCoupons = coupons.length;
 const activeCoupons = coupons.filter(c => c.is_active && !isExpired(c.expiry_date)).length;
 const totalUsage = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);
 const expiredCoupons = coupons.filter(c => isExpired(c.expiry_date)).length;
 
 return {
 totalCoupons,
 activeCoupons,
 totalUsage,
 expiredCoupons
 };
 }, [coupons]);

 return (
 <AdminLayout>
 <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
 {/* Success Toast */}
 {showSuccessToast && (
 <div className="fixed top-4 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-3 text-white shadow-2xl md:left-auto md:right-4 md:translate-x-0">
 <AlertCircle className="w-6 h-6" />
 <p className="font-semibold text-sm md:text-base">{toastMessage}</p>
 </div>
 )}

 {/* Header Actions */}
 <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2 sm:items-center">
 <button
 type="button"
 onClick={() => window.location.reload()}
 className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm sm:w-auto"
 >
 <RefreshCw className="h-4 w-4" />
 Refresh
 </button>
 <button
 type="button"
 onClick={() => setShowForm(true)}
 className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-3 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm sm:w-auto"
 >
 <Plus className="h-4 w-4" />
 Add Coupon
 </button>
 </div>

 {/* Error Message */}
 {error && (
 <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
 <AlertCircle className="h-5 w-5" />
 {error}
 </div>
 )}

 {/* Statistics Cards */}
 <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
 <div className="group rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)] md:p-5">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Total Coupons</p>
 <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{statistics.totalCoupons}</p>
 </div>
 <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
 <Percent className="h-5 w-5" />
 </span>
 </div>
 <p className="mt-4 text-xs font-medium text-slate-500">Complete catalog entries</p>
 </div>
 
 <div className="group rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)] md:p-5">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Active</p>
 <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-700">{statistics.activeCoupons}</p>
 </div>
 <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
 <TrendingUp className="h-5 w-5" />
 </span>
 </div>
 <p className="mt-4 text-xs font-medium text-slate-500">Currently usable</p>
 </div>
 
 <div className="group rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)] md:p-5">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Total Usage</p>
 <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{statistics.totalUsage}</p>
 </div>
 <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
 <Users className="h-5 w-5" />
 </span>
 </div>
 <p className="mt-4 text-xs font-medium text-slate-500">Times redeemed</p>
 </div>
 
 <div className="group rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)] md:p-5">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Expired</p>
 <p className="mt-3 text-3xl font-bold tracking-tight text-red-700">{statistics.expiredCoupons}</p>
 </div>
 <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
 <AlertCircle className="h-5 w-5" />
 </span>
 </div>
 <p className="mt-4 text-xs font-medium text-slate-500">Past expiry date</p>
 </div>
 </div>

 {/* Coupons Section */}
 <section className="rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_34px_rgba(15,64,28,0.1)] md:overflow-hidden">
 <div className="sticky top-[74px] z-20 border-b border-emerald-100 bg-[#f8faf7]/95 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-5 md:static md:bg-[#f8faf7] md:backdrop-blur-none">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <div className="relative w-full lg:max-w-xl">
 <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-emerald-500" />
 <input
 type="text"
 placeholder="Search coupons by code or description"
 className="h-12 w-full rounded-2xl border border-emerald-100 bg-white pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
 />
 </div>
 </div>
 </div>

 {/* Mobile Coupons List */}
 <div className="space-y-2 p-3 md:hidden">
 {coupons.length === 0 ? (
 <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-8 text-center">
 <p className="text-sm font-semibold text-slate-700">No coupons found</p>
 <p className="mt-1 text-xs text-slate-500">
 Create your first coupon to get started.
 </p>
 </div>
 ) : (
 coupons.map(coupon => (
 <article key={coupon.id} className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-base font-mono font-bold text-emerald-700">{coupon.code}</p>
 {coupon.description && (
 <p className="mt-1 line-clamp-2 text-xs text-slate-500">{coupon.description}</p>
 )}
 </div>
 <button
 onClick={() => toggleStatus(coupon.id)}
 className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
 coupon.is_active
 ? 'bg-green-100 text-green-800'
 : 'bg-gray-100 text-gray-800'
 }`}
 >
 {coupon.is_active ? 'Active' : 'Inactive'}
 </button>
 </div>

 <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
 <div className="rounded-md border border-emerald-100 bg-[#f0f8f2] p-2.5">
 <p className="text-slate-500">Discount</p>
 <p className="mt-0.5 font-semibold text-slate-900">
 {coupon.discount_type === 'percentage'
 ? `${coupon.discount_value}%`
 : formatPrice(coupon.discount_value)
 }
 </p>
 {coupon.max_discount && coupon.discount_type === 'percentage' && (
 <p className="mt-0.5 text-[11px] text-slate-500">Max: {formatPrice(coupon.max_discount)}</p>
 )}
 </div>
 <div className="rounded-md border border-emerald-100 bg-[#f0f8f2] p-2.5">
 <p className="text-slate-500">Min. Order</p>
 <p className="mt-0.5 font-semibold text-slate-900">{formatPrice(coupon.min_order_amount)}</p>
 </div>
 <div className="rounded-md border border-emerald-100 bg-[#f0f8f2] p-2.5">
 <p className="text-slate-500">Usage</p>
 <p className="mt-0.5 font-semibold text-slate-900">
 {coupon.used_count || 0}
 {coupon.usage_limit && ` / ${coupon.usage_limit}`}
 </p>
 </div>
 <div className="rounded-md border border-emerald-100 bg-[#f0f8f2] p-2.5">
 <p className="text-slate-500">Expiry</p>
 {coupon.expiry_date ? (
 <div className={isExpired(coupon.expiry_date) ? 'text-red-600' : 'text-slate-900'}>
 <p className="font-semibold mt-0.5">{new Date(coupon.expiry_date).toLocaleDateString()}</p>
 {isExpired(coupon.expiry_date) && <p className="text-[11px]">Expired</p>}
 </div>
 ) : (
 <p className="mt-0.5 font-semibold text-slate-500">No expiry</p>
 )}
 </div>
 </div>

 <div className="mt-3 inline-flex items-center gap-1">
 <button
 onClick={() => handleEdit(coupon)}
 className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700"
 >
 <Pencil className="h-3 w-3" />
 Edit
 </button>
 <button
 onClick={() => handleDelete(coupon.id)}
 className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600"
 >
 <Trash2 className="h-3 w-3" />
 Delete
 </button>
 </div>
 </article>
 ))
 )}
 </div>

 {/* Desktop Coupons Table */}
 <div className="hidden overflow-x-auto md:block">
 <table className="w-full min-w-[980px]">
 <thead>
 <tr className="border-b border-emerald-100 bg-[#f2f8f2] text-left text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
 <th className="px-6 py-4">Code</th>
 <th className="px-4 py-4">Discount</th>
 <th className="px-4 py-4">Min. Order</th>
 <th className="px-4 py-4">Usage</th>
 <th className="px-4 py-4">Expiry</th>
 <th className="px-4 py-4">Status</th>
 <th className="px-6 py-4 text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {coupons.length === 0 ? (
 <tr>
 <td colSpan="7" className="px-6 py-14 text-center">
 <p className="text-base font-semibold text-slate-700">No coupons found</p>
 <p className="mt-1 text-sm text-slate-500">
 Create your first coupon to get started.
 </p>
 </td>
 </tr>
 ) : (
 coupons.map(coupon => (
 <tr key={coupon.id} className="group border-b border-emerald-50 transition-colors duration-200 hover:bg-emerald-50/45">
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <span className="font-mono font-bold text-emerald-700">{coupon.code}</span>
 {coupon.description && (
 <span className="mt-1 text-xs text-slate-500 max-w-[280px] line-clamp-2">{coupon.description}</span>
 )}
 </div>
 </td>
 <td className="px-4 py-4">
 <span className="font-semibold text-slate-900">
 {coupon.discount_type === 'percentage' 
 ? `${coupon.discount_value}%`
 : formatPrice(coupon.discount_value)
 }
 </span>
 {coupon.max_discount && coupon.discount_type === 'percentage' && (
 <div className="text-xs text-slate-500">Max: {formatPrice(coupon.max_discount)}</div>
 )}
 </td>
 <td className="px-4 py-4 text-sm font-semibold text-slate-800">{formatPrice(coupon.min_order_amount)}</td>
 <td className="px-4 py-4">
 <div className="text-sm font-semibold text-slate-800">
 {coupon.used_count || 0}
 {coupon.usage_limit && ` / ${coupon.usage_limit}`}
 </div>
 </td>
 <td className="px-4 py-4">
 {coupon.expiry_date ? (
 <div className={isExpired(coupon.expiry_date) ? 'text-red-600 font-semibold' : 'text-slate-800'}>
 <div className="text-sm">{new Date(coupon.expiry_date).toLocaleDateString()}</div>
 {isExpired(coupon.expiry_date) && (
 <div className="text-xs">Expired</div>
 )}
 </div>
 ) : (
 <span className="text-slate-400">No expiry</span>
 )}
 </td>
 <td className="px-4 py-4">
 <span
 className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
 coupon.is_active
 ? 'bg-emerald-100 text-emerald-700'
 : 'bg-amber-100 text-amber-700'
 }`}
 >
 <span
 className={`h-1.5 w-1.5 rounded-full ${
 coupon.is_active ? 'bg-emerald-600' : 'bg-amber-600'
 }`}
 />
 {coupon.is_active ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <div className="inline-flex items-center gap-2">
 <button
 onClick={() => handleEdit(coupon)}
 className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors duration-200 hover:bg-emerald-50"
 >
 <Pencil className="h-4 w-4" />
 Edit
 </button>
 <button
 onClick={() => handleDelete(coupon.id)}
 className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-50"
 >
 <Trash2 className="h-4 w-4" />
 Delete
 </button>
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </section>

 {/* Coupon Form Modal */}
 {showForm && typeof document !== 'undefined' ? createPortal(
 <div className="fixed inset-0 z-[120] overflow-hidden">
 <div className="absolute -inset-1 bg-slate-950/80 backdrop-blur-lg" />
 <div className="scrollbar-hide relative flex h-full w-full items-end justify-center overflow-y-auto px-0 pb-0 pt-0 sm:items-center sm:px-4 sm:pb-4 sm:pt-[calc(env(safe-area-inset-top)+1.25rem)]">
 <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-emerald-100">
 <div className="sticky top-0 z-20 border-b border-emerald-100/90 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-8 sm:py-5 sm:backdrop-blur-none">
 <div className="flex items-start justify-between gap-4">
 <div>
 <p className="text-[2rem] font-bold tracking-tight text-slate-900 sm:text-2xl">
 {editingCoupon ? 'Edit Coupon' : 'Add Coupon'}
 </p>
 <p className="mt-1 text-sm text-slate-500">
 Create and manage coupon offers for live checkout.
 </p>
 </div>
 <button
 type="button"
 onClick={resetForm}
 className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:rounded-2xl"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>

 <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4 sm:max-h-[72vh] sm:px-8 sm:py-6">
 <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-7">
 <section className="space-y-3 sm:space-y-4">
 <div className="flex items-center gap-2 text-emerald-700">
 <Ticket className="h-4 w-4" />
 <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
 Coupon Details
 </h3>
 </div>

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Coupon Code*
 </span>
 <input
 type="text"
 name="code"
 value={formData.code}
 onChange={handleInputChange}
 required
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 placeholder="e.g., SAVE20"
 />
 </label>

 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Discount Type*
 </span>
 <select
 name="discount_type"
 value={formData.discount_type}
 onChange={handleInputChange}
 required
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 >
 <option value="percentage">Percentage (%)</option>
 <option value="fixed">Fixed Amount (₹)</option>
 </select>
 </label>

 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Discount Value*
 </span>
 <input
 type="number"
 step="0.01"
 name="discount_value"
 value={formData.discount_value}
 onChange={handleInputChange}
 required
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
 />
 </label>

 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Min. Order Amount
 </span>
 <input
 type="number"
 step="0.01"
 name="min_order_amount"
 value={formData.min_order_amount}
 onChange={handleInputChange}
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 placeholder="0"
 />
 </label>

 {formData.discount_type === 'percentage' && (
 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Max Discount Cap
 </span>
 <input
 type="number"
 step="0.01"
 name="max_discount"
 value={formData.max_discount}
 onChange={handleInputChange}
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 placeholder="Optional"
 />
 </label>
 )}

 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Usage Limit
 </span>
 <input
 type="number"
 name="usage_limit"
 value={formData.usage_limit}
 onChange={handleInputChange}
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 placeholder="Unlimited"
 />
 </label>

 <label className="space-y-1.5">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Expiry Date
 </span>
 <input
 type="date"
 name="expiry_date"
 value={formData.expiry_date}
 onChange={handleInputChange}
 className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
 />
 </label>

 <label className="space-y-1.5 sm:col-span-2">
 <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
 Description
 </span>
 <textarea
 rows={3}
 name="description"
 value={formData.description}
 onChange={handleInputChange}
 className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl"
 placeholder="Brief description about this coupon"
 />
 </label>
 </div>
 </section>
 </form>
 </div>

 <div className="sticky bottom-0 z-20 border-t border-emerald-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-sm sm:px-8 sm:py-4 sm:backdrop-blur-none">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
 <button
 type="button"
 onClick={handleSubmit}
 className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d]"
 >
 <CheckCircle2 className="h-4 w-4" />
 {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
 </button>
 <button
 type="button"
 onClick={resetForm}
 className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>,
 document.body
 ) : null}
 </div>
 </AdminLayout>
 );
}
