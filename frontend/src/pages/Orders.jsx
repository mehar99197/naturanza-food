import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, Eye, ArrowLeft, RefreshCw, Filter, Search, Download, Loader2 } from 'lucide-react';
import { OrderTracker } from '@/components/OrderTracker';
import { useOrders } from '@/context/OrderContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { orderAPI } from '@/services/api';
import { formatPrice } from '@/lib/utils';
import { NoIndexSEO } from '@/components/SEO';

export function Orders() {
 const { settings } = useSettings();
 const { orders: allOrders } = useOrders();
 const { user } = useAuth();
 const [orders, setOrders] = useState([]);
 const [selectedOrder, setSelectedOrder] = useState(null);
 const [filterStatus, setFilterStatus] = useState('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [loading, setLoading] = useState(false);
 const [downloadingInvoice, setDownloadingInvoice] = useState(false);
 const [invoiceError, setInvoiceError] = useState('');
 const [invoiceSuccess, setInvoiceSuccess] = useState('');
 const downloadInFlightRef = useRef(false);

 const getInvoiceErrorMessage = async (
 error,
 fallback = 'Invoice download failed. Please try again.',
 ) => {
 const isTimeoutError =
 error?.code === 'ECONNABORTED' ||
 /timeout/i.test(String(error?.message || ''));

 if (isTimeoutError) {
 return 'Invoice generation is taking longer than expected. Please wait and try again.';
 }

 const responseData = error?.response?.data;

 if (responseData instanceof Blob) {
 try {
 const text = await responseData.text();
 const parsed = JSON.parse(text);
 if (parsed?.error) {
 return String(parsed.error);
 }
 if (parsed?.message) {
 return String(parsed.message);
 }
 } catch {
 // Ignore parse issues and use fallback below.
 }
 }

 const isNetworkError = /network error/i.test(String(error?.message || ''));
 if (isNetworkError) {
 return 'Could not contact the server while downloading invoice. Please try again.';
 }

 return error?.response?.data?.error || error?.message || fallback;
 };

 // Sync orders from OrderContext
 useEffect(() => {
 // Filter orders for current user if logged in, otherwise show all orders from this session
 const userOrders = user && user.id 
 ? allOrders.filter(order => order.user_id === user.id)
 : allOrders; // Show all orders if not logged in (for demo purposes)
 
 // Sort by date, most recent first 
 const sortedOrders = [...userOrders].sort((a, b) => 
 new Date(b.order_date) - new Date(a.order_date)
 );
 
 setOrders(sortedOrders);
 }, [allOrders, user]);

 useEffect(() => {
 if (!selectedOrder) {
 return;
 }
 setInvoiceError('');
 setInvoiceSuccess('');
 }, [selectedOrder?.id]);

 // Filter orders
 const filteredOrders = orders.filter(order => {
 const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
 const orderNum = `ORD-${order.id.toString().padStart(6, '0')}`;
 const matchesSearch = orderNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (order.customer_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
 (order.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase());
 return matchesStatus && matchesSearch;
 });

 const getStatusColor = (status) => {
 const colors = {
 pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
 processing: 'bg-blue-100 text-blue-800 border-blue-300',
 confirmed: 'bg-indigo-100 text-indigo-800 border-indigo-300',
 shipped: 'bg-purple-100 text-purple-800 border-purple-300',
 delivered: 'bg-green-100 text-green-800 border-green-300',
 cancelled: 'bg-red-100 text-red-800 border-red-300'
 };
 return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
 };

 const formatDate = (dateString) => {
 return new Intl.DateTimeFormat('en-US', {
 year: 'numeric',
 month: 'long',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 }).format(new Date(dateString));
 };

 const handleDownloadInvoice = async () => {
 if (!selectedOrder || downloadInFlightRef.current) {
 return;
 }

 let objectUrl = '';
 let downloadCompleted = false;

 try {
 downloadInFlightRef.current = true;
 setDownloadingInvoice(true);
 setInvoiceError('');
 setInvoiceSuccess('');

 const orderNumber = `ORD-${String(selectedOrder.id).padStart(6, '0')}`;
 const response = await orderAPI.downloadInvoice(selectedOrder.id);

 if (response?.status !== 200) {
 throw new Error('Invoice request did not complete successfully.');
 }

 const fileName = response.filename || `invoice-${orderNumber}.pdf`;
 const invoiceBlob = response?.blob;

 if (!(invoiceBlob instanceof Blob) || invoiceBlob.size === 0) {
 throw new Error('Invoice file is empty.');
 }

 const pdfBlob = new Blob([invoiceBlob], {
 type: response?.contentType || 'application/pdf',
 });

 objectUrl = window.URL.createObjectURL(pdfBlob);
 const link = document.createElement('a');
 link.href = objectUrl;
 link.setAttribute('download', fileName);
 link.rel = 'noopener';
 document.body.appendChild(link);
 link.click();
 link.remove();

 downloadCompleted = true;
 setInvoiceSuccess('Invoice PDF downloaded successfully.');
 } catch (error) {
 if (!downloadCompleted) {
 const message = await getInvoiceErrorMessage(error);
 setInvoiceError(message);
 }
 } finally {
 if (objectUrl) {
 window.setTimeout(() => {
 window.URL.revokeObjectURL(objectUrl);
 }, 1000);
 }
 downloadInFlightRef.current = false;
 setDownloadingInvoice(false);
 }
 };

if (selectedOrder) {
    return (
      <>
        <NoIndexSEO title="Order Details" />
      <main className="pt-20 sm:pt-24 md:pt-28 pb-12 sm:pb-16 min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 sm:px-6">
 <div className="container-custom max-w-4xl">
 {/* Back Button */}
 <button
 onClick={() => setSelectedOrder(null)}
 className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 text-sm sm:text-base"
 >
 <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
 Back to Orders
 </button>

 {/* Order Details Header */}
 <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 border border-gray-100">
 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
 <div>
 <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
 Order Details
 </h1>
 <p className="text-sm sm:text-base text-gray-600">
 Order #ORD-{selectedOrder.id.toString().padStart(6, '0')}
 </p>
 </div>
 <span className={`self-start md:self-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border-2 ${getStatusColor(selectedOrder.status)}`}>
 {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
 </span>
 </div>

 {/* Order Info Grid */}
 <div className="grid md:grid-cols-2 gap-4 sm:gap-6 pt-4 sm:pt-6 border-t">
 <div>
 <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1.5 sm:mb-2">Customer Information</h3>
 <p className="text-sm sm:text-base text-gray-900 font-medium">{selectedOrder.customer_name}</p>
 <p className="text-xs sm:text-sm text-gray-600">{selectedOrder.customer_email}</p>
 <p className="text-xs sm:text-sm text-gray-600">{selectedOrder.customer_phone}</p>
 </div>
 <div>
 <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1.5 sm:mb-2">Delivery Address</h3>
 <p className="text-sm sm:text-base text-gray-900">{selectedOrder.shipping_address}</p>
 <p className="text-xs sm:text-sm text-gray-600">{selectedOrder.city}, {selectedOrder.postal_code}</p>
 </div>

 <div className="mt-4 sm:mt-6 flex flex-col gap-2">
 <button
 onClick={handleDownloadInvoice}
 disabled={downloadingInvoice}
 className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border ${
 downloadingInvoice
 ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
 : 'border-green-200 text-green-700 hover:bg-green-50'
 }`}
 >
 {downloadingInvoice ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Downloading...
 </>
 ) : (
 <>
 <Download className="w-4 h-4" />
 Download Invoice
 </>
 )}
 </button>

 {invoiceError ? (
 <p className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
 {invoiceError}
 </p>
 ) : null}

 {invoiceSuccess ? (
 <p className="text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
 {invoiceSuccess}
 </p>
 ) : null}
 </div>
 </div>
 </div>

 {/* Order Tracker */}
 <OrderTracker 
 currentStatus={selectedOrder.status}
 trackingNumber={`TRK-${selectedOrder.id.toString().padStart(8, '0')}`}
 estimatedDelivery={selectedOrder.estimated_delivery || 'Calculating...'}
 />

 {/* Order Items */}
 <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mt-4 sm:mt-6">
 <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Order Items</h3>
 <div className="space-y-3 sm:space-y-4">
 {selectedOrder.items.map((item, index) => (
 <div key={index} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
 <img
 src={item.image_url || item.image}
 alt={item.product_name || item.name}
 className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
 onError={(e) => {
                          e.target.src = '/images/products/honey.webp';
 }}
 />
 <div className="flex-1 min-w-0">
 <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{item.product_name || item.name}</h4>
 <p className="text-xs sm:text-sm text-gray-600">Quantity: {item.quantity}</p>
 <p className="text-green-600 font-semibold mt-1 text-sm sm:text-base">
 {formatPrice(item.price * item.quantity, settings.currency)}
 </p>
 </div>
 </div>
 ))}
 </div>

 {/* Order Summary */}
 <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t space-y-2">
 <div className="flex justify-between text-sm sm:text-base text-gray-600">
 <span>Subtotal</span>
 <span>{formatPrice(selectedOrder.subtotal, settings.currency)}</span>
 </div>
 <div className="flex justify-between text-sm sm:text-base text-gray-600">
 <span>Tax</span>
 <span>{formatPrice(selectedOrder.tax || 0, settings.currency)}</span>
 </div>
 <div className="flex justify-between text-sm sm:text-base text-gray-600">
 <span>Shipping</span>
 <span>{selectedOrder.shipping_cost === 0 ? 'Free' : formatPrice(selectedOrder.shipping_cost, settings.currency)}</span>
 </div>
 {selectedOrder.discount_amount > 0 && (
 <div className="flex justify-between text-sm sm:text-base text-green-600">
 <span>Discount {selectedOrder.coupon_code && `(${selectedOrder.coupon_code})`}</span>
 <span>-{formatPrice(selectedOrder.discount_amount, settings.currency)}</span>
 </div>
 )}
 <div className="flex justify-between text-lg sm:text-xl font-bold text-gray-900 pt-2 border-t">
 <span>Total</span>
 <span className="text-green-600">{formatPrice(selectedOrder.total_amount, settings.currency)}</span>
 </div>
 </div>

 {/* Payment Method */}
 <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
 <p className="text-xs sm:text-sm text-gray-700">
 <span className="font-semibold">Payment Method:</span>{' '}
 {selectedOrder.payment_method === 'cod' && '💵 Cash on Delivery'}
 {selectedOrder.payment_method === 'easypaisa' && '📱 EasyPaisa'}
 {selectedOrder.payment_method === 'jazzcash' && '📱 JazzCash'}
 {selectedOrder.payment_method === 'creditCard' && '💳 Credit Card'}
 </p>
 </div>
 </div>
</div>
  </main>
  </>
  );
  }

  return (
    <>
      <NoIndexSEO title="My Orders" />
  <main className="pt-20 sm:pt-24 md:pt-28 pb-12 sm:pb-16 min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 sm:px-6">
 <div className="container-custom max-w-6xl">
 {/* Header */}
 <div className="mb-6 sm:mb-8">
 <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">My Orders</h1>
 <p className="text-sm sm:text-base text-gray-600">Track and manage your orders</p>
 </div>

 {/* Filters & Search */}
 <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
 <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
 {/* Search */}
 <div className="flex-1 relative">
 <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
 <input
 type="text"
 placeholder="Search orders..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
 />
 </div>

 {/* Status Filter */}
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="flex-1 md:flex-none px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
 >
 <option value="all">All Orders</option>
 <option value="pending">Pending</option>
 <option value="confirmed">Confirmed</option>
 <option value="processing">Processing</option>
 <option value="shipped">Shipped</option>
 <option value="delivered">Delivered</option>
 <option value="cancelled">Cancelled</option>
 </select>
 </div>

 {/* Refresh Button */}
 <button
 onClick={() => {/* Orders auto-update via context */}}
 className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95"
 title="Orders update automatically"
 >
 <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
 <span className="hidden sm:inline">Auto-Sync</span>
 </button>
 </div>
 </div>

 {/* Orders List */}
 {loading ? (
 <div className="flex items-center justify-center py-16 sm:py-20">
 <div className="text-center">
 <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-3 sm:mb-4" />
 <p className="text-sm sm:text-base text-gray-600">Loading orders...</p>
 </div>
 </div>
 ) : filteredOrders.length === 0 ? (
 <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-8 sm:p-12 text-center">
 <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
 <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No orders found</h3>
 <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
 {searchQuery || filterStatus !== 'all' 
 ? 'Try adjusting your filters' 
 :"You haven't placed any orders yet"}
 </p>
 <Link
 to="/shop"
 className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 active:scale-95"
 >
 Start Shopping
 </Link>
 </div>
 ) : (
 <div className="space-y-3 sm:space-y-4">
 {filteredOrders.map((order) => (
 <div
 key={order.id}
 className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100"
 >
 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
 {/* Order Info */}
 <div className="flex-1">
 <div className="flex items-start justify-between mb-2">
 <div>
 <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
 Order #ORD-{order.id.toString().padStart(6, '0')}
 </h3>
 <p className="text-xs sm:text-sm text-gray-600">
 {formatDate(order.order_date)}
 </p>
 </div>
 </div>
 
 <div className="flex flex-wrap gap-2 mt-3">
 <span className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)}`}>
 {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
 </span>
 <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
 {order.items?.length || 0} Items
 </span>
 <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
 {formatPrice(order.total_amount, settings.currency)}
 </span>
 </div>
 </div>

 {/* View Details Button */}
 <button
 onClick={() => setSelectedOrder(order)}
 className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium active:scale-95"
 >
 <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
 View Details
 </button>
 </div>
 </div>
 ))}
 </div>
)}
  </div>
  </main>
  </>
  );
}
