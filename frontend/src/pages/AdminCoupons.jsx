import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAdminData } from '@/context/AdminDataContext';
import { formatPrice } from '../lib/utils';
import { AlertCircle, TrendingUp, Users, Percent, X } from 'lucide-react';

export default function AdminCoupons() {
 const { coupons, addCoupon, updateCoupon, deleteCoupon, toggleCouponStatus } = useAdminData();
 const [showForm, setShowForm] = useState(false);
 const [editingCoupon, setEditingCoupon] = useState(null);
 const [showSuccessToast, setShowSuccessToast] = useState(false);
 const [toastMessage, setToastMessage] = useState('');
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
 alert('Please fill in required fields (Code and Discount Value)');
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
 alert('Error: ' + (error.response?.data?.error || 'Failed to save coupon'));
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
 alert('Error deleting coupon: ' + (error.response?.data?.error || 'Unknown error'));
 }
 };

 const toggleStatus = async (id) => {
 try {
 await toggleCouponStatus(id);
 } catch (error) {
 alert('Error toggling coupon status: ' + (error.response?.data?.error || 'Unknown error'));
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
 <div className="max-w-7xl mx-auto">
 {/* Success Toast */}
 {showSuccessToast && (
 <div className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 w-[calc(100%-1.5rem)] max-w-md bg-green-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
 <AlertCircle className="w-6 h-6" />
 <p className="font-semibold text-sm md:text-base">{toastMessage}</p>
 </div>
 )}

 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 md:mb-8">
 <h1 className="text-2xl md:text-3xl font-bold leading-tight">Discount Coupons</h1>
 <button
 onClick={() => (showForm ? resetForm() : setShowForm(true))}
 className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 md:px-6 md:py-2 rounded-lg transition text-sm md:text-base w-full sm:w-auto"
 >
 {showForm ? 'Cancel' : '+ New Coupon'}
 </button>
 </div>

 {/* Statistics Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
 <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3.5 md:p-5 border border-blue-200">
 <div className="flex items-center justify-between mb-1.5 md:mb-2">
 <h3 className="text-xs md:text-sm font-medium text-blue-900 leading-tight">Total Coupons</h3>
 <Percent className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
 </div>
 <p className="text-2xl md:text-3xl font-bold text-blue-700 leading-tight">{statistics.totalCoupons}</p>
 </div>
 
 <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3.5 md:p-5 border border-green-200">
 <div className="flex items-center justify-between mb-1.5 md:mb-2">
 <h3 className="text-xs md:text-sm font-medium text-green-900 leading-tight">Active Coupons</h3>
 <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
 </div>
 <p className="text-2xl md:text-3xl font-bold text-green-700 leading-tight">{statistics.activeCoupons}</p>
 </div>
 
 <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3.5 md:p-5 border border-purple-200">
 <div className="flex items-center justify-between mb-1.5 md:mb-2">
 <h3 className="text-xs md:text-sm font-medium text-purple-900 leading-tight">Total Usage</h3>
 <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
 </div>
 <p className="text-2xl md:text-3xl font-bold text-purple-700 leading-tight">{statistics.totalUsage}</p>
 </div>
 
 <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3.5 md:p-5 border border-red-200">
 <div className="flex items-center justify-between mb-1.5 md:mb-2">
 <h3 className="text-xs md:text-sm font-medium text-red-900 leading-tight">Expired</h3>
 <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
 </div>
 <p className="text-2xl md:text-3xl font-bold text-red-700 leading-tight">{statistics.expiredCoupons}</p>
 </div>
 </div>

 {/* Coupon Form */}
 {showForm && (
 <div className="hidden md:flex fixed inset-0 z-40 items-center justify-center p-6">
 <div className="absolute inset-0 bg-black/45" onClick={resetForm} />
 <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold">
 {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
 </h2>
 <button
 onClick={resetForm}
 className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 flex items-center justify-center"
 aria-label="Close form"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-2">Coupon Code*</label>
 <input
 type="text"
 name="code"
 value={formData.code}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="e.g., SAVE20"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Discount Type*</label>
 <select
 name="discount_type"
 value={formData.discount_type}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 >
 <option value="percentage">Percentage (%)</option>
 <option value="fixed">Fixed Amount (₹)</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Discount Value*</label>
 <input
 type="number"
 step="0.01"
 name="discount_value"
 value={formData.discount_value}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Min. Order Amount</label>
 <input
 type="number"
 step="0.01"
 name="min_order_amount"
 value={formData.min_order_amount}
 onChange={handleInputChange}
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="0"
 />
 </div>

 {formData.discount_type === 'percentage' && (
 <div>
 <label className="block text-sm font-medium mb-2">Max Discount Cap</label>
 <input
 type="number"
 step="0.01"
 name="max_discount"
 value={formData.max_discount}
 onChange={handleInputChange}
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Optional"
 />
 </div>
 )}

 <div>
 <label className="block text-sm font-medium mb-2">Usage Limit</label>
 <input
 type="number"
 name="usage_limit"
 value={formData.usage_limit}
 onChange={handleInputChange}
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Unlimited"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Expiry Date</label>
 <input
 type="date"
 name="expiry_date"
 value={formData.expiry_date}
 onChange={handleInputChange}
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 />
 </div>

 <div className="col-span-2">
 <label className="block text-sm font-medium mb-2">Description</label>
 <textarea
 name="description"
 value={formData.description}
 onChange={handleInputChange}
 rows="2"
 className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Brief description about this coupon"
 />
 </div>

 <div className="col-span-2 flex justify-end gap-3 pt-1">
 <button
 type="button"
 onClick={resetForm}
 className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-2.5 rounded-lg transition"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg transition"
 >
 {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Mobile Form Sheet */}
 {showForm && (
 <div className="md:hidden fixed inset-0 z-40">
 <div className="absolute inset-0 bg-black/40" onClick={resetForm} />
 <div className="absolute inset-0 bg-white flex flex-col">
 <div className="shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
 <h2 className="text-lg font-bold text-gray-900">
 {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
 </h2>
 <button
 onClick={resetForm}
 className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 flex items-center justify-center"
 aria-label="Close form"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
 <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
 <div>
 <label className="block text-sm font-medium mb-1.5">Coupon Code*</label>
 <input
 type="text"
 name="code"
 value={formData.code}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="e.g., SAVE20"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Discount Type*</label>
 <select
 name="discount_type"
 value={formData.discount_type}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 >
 <option value="percentage">Percentage (%)</option>
 <option value="fixed">Fixed Amount (₹)</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Discount Value*</label>
 <input
 type="number"
 step="0.01"
 name="discount_value"
 value={formData.discount_value}
 onChange={handleInputChange}
 required
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Min. Order Amount</label>
 <input
 type="number"
 step="0.01"
 name="min_order_amount"
 value={formData.min_order_amount}
 onChange={handleInputChange}
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="0"
 />
 </div>

 {formData.discount_type === 'percentage' && (
 <div>
 <label className="block text-sm font-medium mb-1.5">Max Discount Cap</label>
 <input
 type="number"
 step="0.01"
 name="max_discount"
 value={formData.max_discount}
 onChange={handleInputChange}
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Optional"
 />
 </div>
 )}

 <div>
 <label className="block text-sm font-medium mb-1.5">Usage Limit</label>
 <input
 type="number"
 name="usage_limit"
 value={formData.usage_limit}
 onChange={handleInputChange}
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Unlimited"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Expiry Date</label>
 <input
 type="date"
 name="expiry_date"
 value={formData.expiry_date}
 onChange={handleInputChange}
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1.5">Description</label>
 <textarea
 name="description"
 value={formData.description}
 onChange={handleInputChange}
 rows="3"
 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500"
 placeholder="Brief description about this coupon"
 />
 </div>
 </div>

 <div className="shrink-0 border-t border-gray-200 p-4 grid grid-cols-2 gap-2 bg-white">
 <button
 type="button"
 onClick={resetForm}
 className="h-11 rounded-lg bg-gray-100 text-gray-700 font-semibold"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="h-11 rounded-lg bg-green-600 text-white font-semibold"
 >
 {editingCoupon ? 'Update' : 'Create'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Mobile Coupons List */}
 <div className="md:hidden space-y-3 mb-4">
 {coupons.length === 0 ? (
 <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 text-center text-gray-500">
 No coupons found. Create your first coupon!
 </div>
 ) : (
 coupons.map(coupon => (
 <div key={coupon.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="font-mono font-bold text-green-600 text-base truncate">{coupon.code}</p>
 {coupon.description && (
 <p className="text-xs text-gray-500 mt-1 line-clamp-2">{coupon.description}</p>
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
 <div className="rounded-md bg-gray-50 p-2.5">
 <p className="text-gray-500">Discount</p>
 <p className="font-semibold text-gray-900 mt-0.5">
 {coupon.discount_type === 'percentage'
 ? `${coupon.discount_value}%`
 : formatPrice(coupon.discount_value)
 }
 </p>
 {coupon.max_discount && coupon.discount_type === 'percentage' && (
 <p className="text-[11px] text-gray-500 mt-0.5">Max: {formatPrice(coupon.max_discount)}</p>
 )}
 </div>
 <div className="rounded-md bg-gray-50 p-2.5">
 <p className="text-gray-500">Min. Order</p>
 <p className="font-semibold text-gray-900 mt-0.5">{formatPrice(coupon.min_order_amount)}</p>
 </div>
 <div className="rounded-md bg-gray-50 p-2.5">
 <p className="text-gray-500">Usage</p>
 <p className="font-semibold text-gray-900 mt-0.5">
 {coupon.used_count || 0}
 {coupon.usage_limit && ` / ${coupon.usage_limit}`}
 </p>
 </div>
 <div className="rounded-md bg-gray-50 p-2.5">
 <p className="text-gray-500">Expiry</p>
 {coupon.expiry_date ? (
 <div className={isExpired(coupon.expiry_date) ? 'text-red-600' : 'text-gray-900'}>
 <p className="font-semibold mt-0.5">{new Date(coupon.expiry_date).toLocaleDateString()}</p>
 {isExpired(coupon.expiry_date) && <p className="text-[11px]">Expired</p>}
 </div>
 ) : (
 <p className="font-semibold text-gray-500 mt-0.5">No expiry</p>
 )}
 </div>
 </div>

 <div className="mt-3 grid grid-cols-2 gap-2">
 <button
 onClick={() => handleEdit(coupon)}
 className="h-9 rounded-lg border border-blue-200 text-blue-700 font-medium text-sm active:scale-[0.99]"
 >
 Edit
 </button>
 <button
 onClick={() => handleDelete(coupon.id)}
 className="h-9 rounded-lg border border-red-200 text-red-700 font-medium text-sm active:scale-[0.99]"
 >
 Delete
 </button>
 </div>
 </div>
 ))
 )}
 </div>

 {/* Coupons Table */}
 <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Order</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {coupons.length === 0 ? (
 <tr>
 <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
 No coupons found. Create your first coupon!
 </td>
 </tr>
 ) : (
 coupons.map(coupon => (
 <tr key={coupon.id} className="hover:bg-gray-50">
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <span className="font-mono font-bold text-green-600">{coupon.code}</span>
 {coupon.description && (
 <span className="text-xs text-gray-500 mt-1">{coupon.description}</span>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 <span className="font-semibold">
 {coupon.discount_type === 'percentage' 
 ? `${coupon.discount_value}%`
 : formatPrice(coupon.discount_value)
 }
 </span>
 {coupon.max_discount && coupon.discount_type === 'percentage' && (
 <div className="text-xs text-gray-500">Max: {formatPrice(coupon.max_discount)}</div>
 )}
 </td>
 <td className="px-6 py-4">{formatPrice(coupon.min_order_amount)}</td>
 <td className="px-6 py-4">
 <div className="text-sm">
 {coupon.used_count || 0}
 {coupon.usage_limit && ` / ${coupon.usage_limit}`}
 </div>
 </td>
 <td className="px-6 py-4">
 {coupon.expiry_date ? (
 <div className={isExpired(coupon.expiry_date) ? 'text-red-600 font-semibold' : ''}>
 {new Date(coupon.expiry_date).toLocaleDateString()}
 {isExpired(coupon.expiry_date) && (
 <div className="text-xs">Expired</div>
 )}
 </div>
 ) : (
 <span className="text-gray-400">No expiry</span>
 )}
 </td>
 <td className="px-6 py-4">
 <button
 onClick={() => toggleStatus(coupon.id)}
 className={`px-3 py-1 rounded-full text-xs font-semibold ${
 coupon.is_active
 ? 'bg-green-100 text-green-800'
 : 'bg-gray-100 text-gray-800'
 }`}
 >
 {coupon.is_active ? 'Active' : 'Inactive'}
 </button>
 </td>
 <td className="px-6 py-4">
 <div className="flex gap-2">
 <button
 onClick={() => handleEdit(coupon)}
 className="text-blue-600 hover:text-blue-800 font-medium"
 >
 Edit
 </button>
 <button
 onClick={() => handleDelete(coupon.id)}
 className="text-red-600 hover:text-red-800 font-medium"
 >
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
 </div>
 </div>
 </AdminLayout>
 );
}
