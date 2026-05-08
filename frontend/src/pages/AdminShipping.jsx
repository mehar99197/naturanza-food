import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Package,
  RefreshCw,
  Save,
  Search,
  Truck,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { useOrders } from "@/context/OrderContext";
import { orderAPI } from "@/services/api";

const shipmentStatusLabel = {
  pending: "Pending",
  packed: "Packed",
  shipped: "In Transit",
  delivered: "Delivered",
  returned: "Returned",
};

const shipmentBadgeClass = {
  pending: "bg-yellow-100 text-yellow-700",
  packed: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
};

const MOBILE_INITIAL_SHIPMENTS = 6;

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const toDateInput = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

export function AdminShipping() {
  const { orders, fetchOrders, loading, updateOrderStatus } = useOrders();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [mobileView, setMobileView] = useState("queue");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [formData, setFormData] = useState({
    courier_name: "",
    tracking_number: "",
    shipment_status: "pending",
    estimated_delivery: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const shippingRows = useMemo(() => {
    return [...orders]
      .filter((order) => {
        const hasShipment = Boolean(order.shipment);
        const shippingStatusOrder = ["processing", "shipped", "delivered"].includes(
          String(order.status || "").toLowerCase(),
        );
        return hasShipment || shippingStatusOrder;
      })
      .filter((order) => {
        const status = String(order.shipment?.shipment_status || "pending").toLowerCase();
        const query = searchQuery.trim().toLowerCase();

        const matchesFilter = statusFilter === "all" || status === statusFilter;
        if (!query) {
          return matchesFilter;
        }

        const searchable = [
          order.id,
          order.customer_name,
          order.customer_email,
          order.shipment?.tracking_number,
          order.shipment?.courier_name,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return matchesFilter && searchable.includes(query);
      })
      .sort(
        (a, b) =>
          new Date(b.order_date || b.created_at) -
          new Date(a.order_date || a.created_at),
      );
  }, [orders, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const byStatus = {
      pending: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
    };

    shippingRows.forEach((order) => {
      const status = String(order.shipment?.shipment_status || "pending").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
        byStatus[status] += 1;
      }
    });

    return {
      total: shippingRows.length,
      inTransit: byStatus.shipped,
      delivered: byStatus.delivered,
      pending: byStatus.pending + byStatus.packed,
    };
  }, [shippingRows]);

  const selectedOrder = shippingRows.find((item) => item.id === selectedOrderId) || null;

  const quickSummaryItems = useMemo(
    () => [
      { key: "total", label: "Total", value: metrics.total },
      { key: "transit", label: "Transit", value: metrics.inTransit },
      { key: "delivered", label: "Delivered", value: metrics.delivered },
      { key: "pending", label: "Pending", value: metrics.pending },
    ],
    [metrics.delivered, metrics.inTransit, metrics.pending, metrics.total],
  );

  const openEditor = (order) => {
    setSelectedOrderId(order.id);
    setMobileView("detail");
    setFormData({
      courier_name: String(order.shipment?.courier_name || ""),
      tracking_number: String(order.shipment?.tracking_number || ""),
      shipment_status: String(order.shipment?.shipment_status || "pending"),
      estimated_delivery: toDateInput(order.shipment?.estimated_delivery),
    });
    setError("");
  };

  const refreshShipments = async () => {
    try {
      setError("");
      await fetchOrders();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to refresh shipments");
    }
  };

  const saveShipment = async () => {
    if (!selectedOrder) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await orderAPI.updateShipment(selectedOrder.id, {
        courier_name: formData.courier_name || null,
        tracking_number: formData.tracking_number || null,
        shipment_status: formData.shipment_status,
        estimated_delivery: formData.estimated_delivery || null,
      });

      if (formData.shipment_status === "shipped" && selectedOrder.status !== "shipped") {
        await updateOrderStatus(selectedOrder.id, "shipped", selectedOrder.payment_status, {
          courier_name: formData.courier_name || undefined,
          tracking_number: formData.tracking_number || undefined,
          estimated_delivery: formData.estimated_delivery || undefined,
        });
      }

      if (
        formData.shipment_status === "delivered" &&
        selectedOrder.status !== "delivered"
      ) {
        await updateOrderStatus(selectedOrder.id, "delivered", selectedOrder.payment_status, {
          courier_name: formData.courier_name || undefined,
          tracking_number: formData.tracking_number || undefined,
          estimated_delivery: formData.estimated_delivery || undefined,
        });
      }

      await fetchOrders();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update shipment");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [searchQuery, statusFilter]);

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={4} rows={8} showSidebar />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Shipping Center</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Manage courier details and shipment statuses using real order records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshShipments()}
            className="inline-flex h-10 self-end items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:self-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="grid grid-cols-4 gap-1.5">
              {quickSummaryItems.map((item) => (
                <article key={item.key} className="rounded-xl border border-emerald-100 bg-[#f7fbf7] px-1.5 py-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Shipments</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In Transit</p>
            <p className="mt-2 text-2xl font-bold text-indigo-700">{metrics.inTransit}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivered</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.delivered}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending/Packed</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{metrics.pending}</p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="inline-flex rounded-full border border-emerald-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileView("queue")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "queue" ? "bg-emerald-700 text-white" : "text-slate-600"
              }`}
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => setMobileView("detail")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "detail" ? "bg-emerald-700 text-white" : "text-slate-600"
              }`}
            >
              Detail
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[62%_38%]">
          <div className={`rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_30px_rgba(15,64,28,0.08)] ${mobileView === "detail" ? "hidden md:block" : "block"}`}>
            <div className="border-b border-emerald-100 p-4">
              <p className="text-lg font-bold text-slate-900">Shipment Queue</p>
            </div>

            <div className="border-b border-emerald-100 p-4">
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by order/customer/tracking"
                  className="w-full rounded-xl border border-emerald-100 py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "packed", label: "Packed" },
                  { value: "shipped", label: "In Transit" },
                  { value: "delivered", label: "Delivered" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                      statusFilter === item.value
                        ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                        : "bg-emerald-100 text-slate-600 hover:bg-emerald-200/70 hover:text-emerald-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[64vh] overflow-y-auto divide-y divide-emerald-100">
              {shippingRows.length > 0 ? (
                <>
                  {shippingRows.map((order, index) => {
                  const shipmentStatus = String(order.shipment?.shipment_status || "pending").toLowerCase();
                  const isActive = order.id === selectedOrderId;
                  return (
                    <div
                      key={order.id}
                      className={`${!showAllMobileRows && index >= MOBILE_INITIAL_SHIPMENTS ? "hidden md:block" : "block"}`}
                    >
                      <button
                        type="button"
                        onClick={() => openEditor(order)}
                        className={`w-full p-4 text-left transition-colors ${
                          isActive ? "bg-emerald-50" : "hover:bg-emerald-50/40"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">ORD-{String(order.id).padStart(6, "0")}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              shipmentBadgeClass[shipmentStatus] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {shipmentStatusLabel[shipmentStatus] || shipmentStatus}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-600">
                          {order.customer_name || order.customer_email || "Customer"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {order.shipment?.courier_name || "No courier"} · {order.shipment?.tracking_number || "No tracking"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">Order date: {formatDate(order.order_date || order.created_at)}</p>
                      </button>
                    </div>
                  );
                  })}

                  {shippingRows.length > MOBILE_INITIAL_SHIPMENTS ? (
                    <div className="border-t border-gray-100 p-3 md:hidden">
                      <button
                        type="button"
                        onClick={() => setShowAllMobileRows((prev) => !prev)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                      >
                        {showAllMobileRows
                          ? "Show fewer shipments"
                          : `Show all ${shippingRows.length} shipments`}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="p-4 text-sm text-slate-500">No shipment records found.</p>
              )}
            </div>
          </div>

          <div className={`rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6 ${mobileView === "queue" ? "hidden md:block" : "block"}`}>
            {selectedOrder ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 md:hidden"
                >
                  Back to queue
                </button>

                <div>
                  <p className="text-xl font-bold text-slate-900">ORD-{String(selectedOrder.id).padStart(6, "0")}</p>
                  <p className="text-sm text-slate-500">
                    {selectedOrder.customer_name || selectedOrder.customer_email || "Customer"}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Courier Name
                    <input
                      type="text"
                      value={formData.courier_name}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, courier_name: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Leopard / TCS / BlueEX"
                    />
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tracking Number
                    <input
                      type="text"
                      value={formData.tracking_number}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, tracking_number: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="TRK-XXXXXXXX"
                    />
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipment Status
                    <select
                      value={formData.shipment_status}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, shipment_status: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                      <option value="pending">Pending</option>
                      <option value="packed">Packed</option>
                      <option value="shipped">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="returned">Returned</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estimated Delivery
                    <div className="relative mt-1.5">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={formData.estimated_delivery}
                        onChange={(event) =>
                          setFormData((prev) => ({ ...prev, estimated_delivery: event.target.value }))
                        }
                        className="w-full rounded-xl border border-emerald-100 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveShipment()}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Shipment
                </button>

                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3 text-xs text-slate-600">
                  <p className="mb-1 inline-flex items-center gap-1 font-semibold text-slate-700">
                    <Package className="h-3.5 w-3.5" />
                    Order Status: {selectedOrder.status}
                  </p>
                  <p className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    Updating to In Transit or Delivered also syncs order status.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Truck className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-slate-900">Select a Shipment</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Pick an order from the shipment queue to edit courier, tracking, and delivery details.
                </p>
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 md:hidden"
                >
                  Go to queue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
