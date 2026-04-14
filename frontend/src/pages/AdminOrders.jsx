import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { useOrders } from "@/context/OrderContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";

const statusClass = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-sky-100 text-sky-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentClass = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export function AdminOrders() {
  const {
    orders,
    loading,
    fetchOrders,
    updateOrderStatus,
    deleteOrder,
    getOrderStats,
  } = useOrders();
  const { settings } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mobileView, setMobileView] = useState("queue");
  const [statusForm, setStatusForm] = useState({
    status: "pending",
    payment_status: "pending",
    courier_name: "",
    tracking_number: "",
    note: "",
  });

  const orderRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const matchesStatus =
          statusFilter === "all" || String(order.status || "pending") === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!query) {
          return true;
        }

        const orderCode = `ORD-${String(order.id).padStart(6, "0")}`;
        const searchable = [
          orderCode,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.shipping_address,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return searchable.includes(query);
      })
      .sort(
        (a, b) =>
          new Date(b.order_date || b.created_at || 0) -
          new Date(a.order_date || a.created_at || 0),
      );
  }, [orders, searchQuery, statusFilter]);

  const selectedOrder = orderRows.find((order) => order.id === selectedOrderId) || null;
  const orderStats = getOrderStats();

  const quickSummaryItems = [
    { key: "total", label: "Orders", value: orderStats.total },
    { key: "pending", label: "Pending", value: orderStats.pending },
    { key: "shipped", label: "Shipped", value: orderStats.shipped },
    { key: "delivered", label: "Delivered", value: orderStats.delivered },
  ];

  useEffect(() => {
    if (!orderRows.length) {
      setSelectedOrderId(null);
      setMobileView("queue");
      return;
    }

    const exists = orderRows.some((order) => order.id === selectedOrderId);
    if (!exists) {
      setSelectedOrderId(orderRows[0].id);
    }
  }, [orderRows, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }

    setStatusForm({
      status: String(selectedOrder.status || "pending"),
      payment_status: String(selectedOrder.payment_status || "pending"),
      courier_name: String(selectedOrder.shipment?.courier_name || ""),
      tracking_number: String(selectedOrder.shipment?.tracking_number || ""),
      note: "",
    });
  }, [selectedOrder]);

  const refreshOrders = async () => {
    try {
      setError("");
      await fetchOrders();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to refresh orders");
    }
  };

  const saveOrderStatus = async () => {
    if (!selectedOrder) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await updateOrderStatus(selectedOrder.id, statusForm.status, statusForm.payment_status, {
        courier_name: statusForm.courier_name || undefined,
        tracking_number: statusForm.tracking_number || undefined,
        note: statusForm.note || undefined,
      });

      await fetchOrders();
      setStatusForm((prev) => ({ ...prev, note: "" }));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update order status");
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedOrder = async () => {
    if (!selectedOrder) {
      return;
    }

    if (!window.confirm(`Delete ORD-${String(selectedOrder.id).padStart(6, "0")}?`)) {
      return;
    }

    try {
      setError("");
      await deleteOrder(selectedOrder.id);
      await fetchOrders();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete order");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={4} rows={8} showSidebar />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 sm:text-3xl">Orders</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Monitor and update order lifecycle with real-time shipment and payment data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshOrders()}
            className="inline-flex h-9 self-end items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:self-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
            <div className="grid grid-cols-4 gap-1.5">
              {quickSummaryItems.map((item) => (
                <article key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-extrabold text-gray-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Orders</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{orderStats.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{orderStats.pending}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shipped</p>
            <p className="mt-2 text-2xl font-bold text-indigo-700">{orderStats.shipped}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivered</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{orderStats.delivered}</p>
          </div>
        </div>

        <div className="md:hidden">
          <div className="inline-flex w-full rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileView("queue")}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-colors ${
                mobileView === "queue" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
              }`}
            >
              Queue ({orderRows.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileView("detail")}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-colors ${
                mobileView === "detail" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
              }`}
            >
              Detail
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[44%_56%]">
          <div
            className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${
              mobileView === "detail" ? "hidden xl:block" : "block"
            }`}
          >
            <div className="border-b border-gray-100 p-4">
              <p className="text-lg font-bold text-gray-900">Order Queue</p>
            </div>

            <div className="border-b border-gray-100 p-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by order ID, customer or email"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "processing", label: "Processing" },
                  { value: "shipped", label: "Shipped" },
                  { value: "delivered", label: "Delivered" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusFilter === item.value
                        ? "bg-[#2a5f1e] text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[46vh] overflow-y-auto divide-y divide-gray-100 sm:max-h-[56vh] xl:max-h-[64vh]">
              {orderRows.length > 0 ? (
                orderRows.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setMobileView("detail");
                    }}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedOrderId === order.id ? "bg-emerald-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">ORD-{String(order.id).padStart(6, "0")}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          statusClass[String(order.status || "pending")] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {String(order.status || "pending")}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-600">
                      {order.customer_name || order.customer_email || "Customer"}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDateTime(order.order_date || order.created_at)}</span>
                      <span>{formatPrice(Number(order.total_amount || 0), settings.currency)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="p-4 text-sm text-gray-500">No orders found.</p>
              )}
            </div>
          </div>

          <div
            className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${
              mobileView === "queue" ? "hidden xl:block" : "block"
            } max-h-[75vh] overflow-y-auto xl:max-h-none xl:overflow-visible`}
          >
            {selectedOrder ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 xl:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to queue
                </button>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-gray-900">ORD-{String(selectedOrder.id).padStart(6, "0")}</p>
                    <p className="text-sm text-gray-600">
                      {selectedOrder.customer_name || selectedOrder.customer_email || "Customer"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-gray-900">
                      {formatPrice(Number(selectedOrder.total_amount || 0), settings.currency)}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        paymentClass[String(selectedOrder.payment_status || "pending")] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      payment: {String(selectedOrder.payment_status || "pending")}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shipping Address</p>
                  <p className="mt-1 text-sm text-gray-700">{selectedOrder.shipping_address || "-"}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Order Status
                    <select
                      value={statusForm.status}
                      onChange={(event) =>
                        setStatusForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                    >
                      {[
                        "pending",
                        "confirmed",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Payment Status
                    <select
                      value={statusForm.payment_status}
                      onChange={(event) =>
                        setStatusForm((prev) => ({ ...prev, payment_status: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                    >
                      {[
                        "pending",
                        "paid",
                        "failed",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <input
                    type="text"
                    value={statusForm.courier_name}
                    onChange={(event) =>
                      setStatusForm((prev) => ({ ...prev, courier_name: event.target.value }))
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                    placeholder="Courier name"
                  />

                  <input
                    type="text"
                    value={statusForm.tracking_number}
                    onChange={(event) =>
                      setStatusForm((prev) => ({ ...prev, tracking_number: event.target.value }))
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                    placeholder="Tracking number"
                  />

                  <textarea
                    rows={3}
                    value={statusForm.note}
                    onChange={(event) =>
                      setStatusForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                    className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                    placeholder="Admin note"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveOrderStatus()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#2a5f1e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#224f18] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Save Update
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSelectedOrder()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Order
                  </button>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
                    <ShoppingBag className="h-4 w-4" />
                    Items ({Array.isArray(selectedOrder.items) ? selectedOrder.items.length : 0})
                  </p>
                  <div className="space-y-2">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <div
                          key={`${selectedOrder.id}-${index}`}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
                        >
                          <p className="truncate pr-3 text-sm text-gray-700">
                            {item.product_name || item.name || "Item"} x {Number(item.quantity || 0)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatPrice(Number(item.subtotal || item.price * item.quantity || 0), settings.currency)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No item details found.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <p className="inline-flex items-center gap-1 font-semibold">
                    <Truck className="h-3.5 w-3.5" />
                    Shipment sync note
                  </p>
                  <p className="mt-1">
                    Updating status to shipped or delivered also syncs shipment timeline for this order.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Package className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-gray-900">Select an Order</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Pick an order from the queue to inspect details and apply status updates.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
