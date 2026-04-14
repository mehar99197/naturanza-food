import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Eye,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { OrderTracker } from "@/components/OrderTracker";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { orderAPI } from "@/services/api";

const getStatusColor = (status) => {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    processing: "bg-blue-100 text-blue-800 border-blue-300",
    confirmed: "bg-indigo-100 text-indigo-800 border-indigo-300",
    shipped: "bg-purple-100 text-purple-800 border-purple-300",
    delivered: "bg-green-100 text-green-800 border-green-300",
    cancelled: "bg-red-100 text-red-800 border-red-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
};

const toTrackerStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "confirmed") return "processing";
  if (normalized === "out_for_delivery") return "outForDelivery";
  if (normalized === "cancelled") return "pending";

  if (["pending", "processing", "shipped", "outfordelivery", "delivered"].includes(normalized)) {
    if (normalized === "outfordelivery") {
      return "outForDelivery";
    }
    return normalized;
  }

  return "pending";
};

const formatDate = (dateString) => {
  if (!dateString) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

const formatCompactDate = (dateString) => {
  if (!dateString) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
};

const isOrderCancellable = (status) =>
  ["pending", "confirmed", "processing"].includes(
    String(status || "").trim().toLowerCase(),
  );

const getInvoiceErrorMessage = async (
  error,
  fallback = "Invoice download failed. Please try again.",
) => {
  const isTimeoutError =
    error?.code === "ECONNABORTED" ||
    /timeout/i.test(String(error?.message || ""));

  if (isTimeoutError) {
    return "Invoice generation is taking longer than expected. Please wait and try again.";
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
      // Ignore parse failures and fall back below.
    }
  }

  const isNetworkError = /network error/i.test(String(error?.message || ""));
  if (isNetworkError) {
    return "Could not contact the server while downloading invoice. Please try again.";
  }

  return error?.response?.data?.error || error?.message || fallback;
};

export function ProfileOrders() {
  const { settings } = useSettings();
  const { orders: allOrders, loading: ordersLoading, fetchOrders } = useOrders();
  const { user } = useAuth();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [detailActionError, setDetailActionError] = useState("");
  const [detailActionSuccess, setDetailActionSuccess] = useState("");
  const downloadInFlightRef = useRef(false);

  const orders = useMemo(() => {
    const userOrders = user?.id
      ? allOrders.filter((order) => Number(order.user_id) === Number(user.id))
      : [];

    return [...userOrders].sort(
      (a, b) =>
        new Date(b.order_date || b.created_at) -
        new Date(a.order_date || a.created_at),
    );
  }, [allOrders, user?.id]);

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }

    const nextSelected = orders.find(
      (order) => Number(order.id) === Number(selectedOrder.id),
    );

    if (nextSelected && nextSelected !== selectedOrder) {
      setSelectedOrder(nextSelected);
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    setDetailActionError("");
    setDetailActionSuccess("");
  }, [selectedOrder?.id]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        filterStatus === "all" || String(order.status) === filterStatus;
      const orderNum = `ORD-${String(order.id || "").padStart(6, "0")}`;
      const query = searchQuery.toLowerCase().trim();

      if (!query) {
        return matchesStatus;
      }

      const matchesSearch =
        orderNum.toLowerCase().includes(query) ||
        String(order.customer_email || "")
          .toLowerCase()
          .includes(query) ||
        String(order.customer_name || "")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, filterStatus, searchQuery]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchOrders();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) {
      return;
    }

    if (!isOrderCancellable(selectedOrder.status)) {
      setDetailActionError("Once an order is shipped, cancellation is not allowed.");
      return;
    }

    try {
      setCancelling(true);
      setDetailActionError("");
      setDetailActionSuccess("");

      await orderAPI.cancel(selectedOrder.id);

      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: "cancelled",
            }
          : prev,
      );

      await fetchOrders();

      setDetailActionSuccess("Order cancelled successfully.");
    } catch (error) {
      setDetailActionError(
        error.response?.data?.error || "Could not cancel this order right now.",
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!selectedOrder || downloadInFlightRef.current) {
      return;
    }

    let objectUrl = "";
    let downloadCompleted = false;

    try {
      downloadInFlightRef.current = true;
      setDownloadingInvoice(true);
      setDetailActionError("");
      setDetailActionSuccess("");

      const orderNumber = `ORD-${String(selectedOrder.id).padStart(6, "0")}`;
      const response = await orderAPI.downloadInvoice(selectedOrder.id);

      if (response?.status !== 200) {
        throw new Error("Invoice request did not complete successfully.");
      }

      const fileName = response.filename || `invoice-${orderNumber}.pdf`;
      const invoiceBlob = response?.blob;

      if (!(invoiceBlob instanceof Blob) || invoiceBlob.size === 0) {
        throw new Error("Invoice file is empty.");
      }

      const pdfBlob = new Blob([invoiceBlob], {
        type: response?.contentType || "application/pdf",
      });

      objectUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", fileName);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();

      downloadCompleted = true;
      setDetailActionSuccess("Invoice PDF downloaded successfully.");
    } catch (error) {
      // Ignore post-download cleanup exceptions for already successful responses.
      if (!downloadCompleted) {
        const message = await getInvoiceErrorMessage(error);
        setDetailActionError(message);
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

  if (ordersLoading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-gray-100 flex items-center justify-center min-h-[220px] sm:min-h-[320px]">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading orders...
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    const orderItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const orderIsCancelled =
      String(selectedOrder.status || "").toLowerCase() === "cancelled";
    const canCancelOrder = isOrderCancellable(selectedOrder.status);

    return (
      <div className="space-y-3 sm:space-y-6">
        <button
          onClick={() => setSelectedOrder(null)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Back to Orders
        </button>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3.5 sm:p-6 md:p-8 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-6">
            <div>
              <h3 className="text-[1.9rem] sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-2 leading-tight">
                Order Details
              </h3>
              <p className="text-sm sm:text-base text-gray-600 leading-tight">
                Order #ORD-{String(selectedOrder.id).padStart(6, "0")}
              </p>
            </div>
            <span
              className={`self-start md:self-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border-2 ${getStatusColor(selectedOrder.status)}`}
            >
              {String(selectedOrder.status || "pending")
                .charAt(0)
                .toUpperCase() + String(selectedOrder.status || "pending").slice(1)}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-3 sm:gap-6 pt-3 sm:pt-6 border-t">
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1.5 sm:mb-2">
                Customer Information
              </h4>
              <p className="text-sm sm:text-base text-gray-900 font-medium">
                {selectedOrder.customer_name || user?.name || "Customer"}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                {selectedOrder.customer_email || user?.email || "-"}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                {selectedOrder.customer_phone || selectedOrder.phone || "-"}
              </p>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1.5 sm:mb-2">
                Delivery Address
              </h4>
              <p className="text-sm sm:text-base text-gray-900">
                {selectedOrder.shipping_address || "Address not available"}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                {selectedOrder.city || ""}
                {selectedOrder.city && selectedOrder.postal_code ? ", " : ""}
                {selectedOrder.postal_code || ""}
              </p>
            </div>
          </div>

          <div className="mt-3.5 sm:mt-6 flex flex-col gap-2.5 sm:gap-3">
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className={`inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border ${
                  downloadingInvoice
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border-green-200 text-green-700 hover:bg-green-50"
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

              <button
                onClick={handleCancelOrder}
                disabled={cancelling || !canCancelOrder || orderIsCancelled}
                className={`inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border ${
                  cancelling || !canCancelOrder || orderIsCancelled
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border-red-600 bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    {orderIsCancelled ? "Order Cancelled" : "Cancel Order"}
                  </>
                )}
              </button>
            </div>

            {!canCancelOrder && !orderIsCancelled && (
              <p className="text-xs sm:text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Once an order is shipped, cancellation is no longer available.
              </p>
            )}

            {detailActionError && (
              <p className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {detailActionError}
              </p>
            )}

            {detailActionSuccess && (
              <p className="text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {detailActionSuccess}
              </p>
            )}
          </div>
        </div>

        {orderIsCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 sm:p-5">
            <p className="text-sm sm:text-base text-red-700 font-medium">
              This order has been cancelled. Tracking is no longer available.
            </p>
          </div>
        ) : (
          <OrderTracker
            currentStatus={toTrackerStatus(selectedOrder.status)}
            trackingNumber={`TRK-${String(selectedOrder.id).padStart(8, "0")}`}
            estimatedDelivery={
              selectedOrder.estimated_delivery
                ? formatDate(selectedOrder.estimated_delivery)
                : "Calculating..."
            }
          />
        )}

          {orderItems.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No order items are available for this order.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {orderItems.map((item, index) => (
                <div
                  key={`${item.product_id || item.id || index}-${index}`}
                  className="flex gap-2.5 sm:gap-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl"
                >
                  <img
                    src={item.image_url || item.image || "/images/products/powder.webp"}
                    alt={item.product_name || item.name || "Order item"}
                    className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                    onError={(event) => {
                      event.currentTarget.src = "/images/products/powder.webp";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight line-clamp-2 sm:truncate">
                      {item.product_name || item.name || "Product"}
                    </h5>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Quantity: {Number(item.quantity || 1)}
                    </p>
                    <p className="text-green-600 font-semibold mt-1 text-sm sm:text-base">
                      {formatPrice(
                        Number(item.price || 0) * Number(item.quantity || 1),
                        settings.currency,
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3.5 sm:mt-6 pt-3.5 sm:pt-6 border-t space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-sm sm:text-base text-gray-600">
              <span>Subtotal</span>
              <span>
                {formatPrice(Number(selectedOrder.subtotal || 0), settings.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm sm:text-base text-gray-600">
              <span>Tax</span>
              <span>{formatPrice(Number(selectedOrder.tax || 0), settings.currency)}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base text-gray-600">
              <span>Shipping</span>
              <span>
                {Number(selectedOrder.shipping_cost || 0) === 0
                  ? "Free"
                  : formatPrice(Number(selectedOrder.shipping_cost || 0), settings.currency)}
              </span>
            </div>
            {Number(selectedOrder.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-sm sm:text-base text-green-600">
                <span>
                  Discount
                  {selectedOrder.coupon_code
                    ? ` (${selectedOrder.coupon_code})`
                    : ""}
                </span>
                <span>
                  -
                  {formatPrice(
                    Number(selectedOrder.discount_amount || 0),
                    settings.currency,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg sm:text-xl font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span className="text-green-600">
                {formatPrice(Number(selectedOrder.total_amount || 0), settings.currency)}
              </span>
            </div>
          </div>

          <div className="mt-3.5 sm:mt-6 p-2.5 sm:p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700 leading-snug">
              <span className="font-semibold">Payment Method:</span>{" "}
              {selectedOrder.payment_method === "cod" && "Cash on Delivery"}
              {selectedOrder.payment_method === "easypaisa" && "EasyPaisa"}
              {selectedOrder.payment_method === "jazzcash" && "JazzCash"}
              {selectedOrder.payment_method === "creditCard" && "Credit Card"}
              {!["cod", "easypaisa", "jazzcash", "creditCard"].includes(
                selectedOrder.payment_method,
              ) && "N/A"}
            </p>
          </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-8 border border-gray-100">
      <div className="mb-3 sm:mb-8">
        <p className="hidden sm:block text-sm sm:text-base text-gray-600">Track and manage your orders</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 sm:p-6 mb-3 sm:mb-6 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="flex-1 md:flex-none min-h-[40px] px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
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

          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 min-h-[40px] px-3.5 sm:px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 disabled:opacity-70"
            title="Refresh orders"
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-100 p-8 sm:p-12 text-center bg-white">
          <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            No orders found
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your filters"
              : "You have not placed any orders yet"}
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
              className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3.5 sm:p-6 border border-gray-100"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                    <div>
                      <h4 className="text-[1.05rem] sm:text-lg font-bold text-gray-900 mb-0.5 sm:mb-1">
                        Order #ORD-{String(order.id).padStart(6, "0")}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        <span className="sm:hidden">
                          {formatCompactDate(order.order_date || order.created_at)}
                        </span>
                        <span className="hidden sm:inline">
                          {formatDate(order.order_date || order.created_at)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                    <span
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)}`}
                    >
                      {String(order.status || "pending")
                        .charAt(0)
                        .toUpperCase() + String(order.status || "pending").slice(1)}
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      {Array.isArray(order.items) ? order.items.length : 0} Items
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      {formatPrice(Number(order.total_amount || 0), settings.currency)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center justify-center gap-2 min-h-[40px] px-3.5 sm:px-6 py-2 text-sm sm:text-base bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium active:scale-95"
                >
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="sm:hidden">Details</span>
                  <span className="hidden sm:inline">View Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfileOrders;
