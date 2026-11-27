import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  RotateCcw,
  Shield,
  Truck,
  Wallet,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { useOrders } from "@/context/OrderContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { adminAPI } from "@/services/api";
import { useSWRCache, invalidateSWRKey } from "@/hooks/useSWRCache";

const META_CACHE_KEY = "admin:payments:meta";

const paymentStatusClass = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-indigo-100 text-indigo-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  refunded: "bg-orange-100 text-orange-700",
};

const formatMethodLabel = (value) => {
  const method = String(value || "unknown").toLowerCase();
  const map = {
    safepay: "SafePay",
    cod: "Cash on Delivery",
    card: "Card",
    online: "Online",
    easypaisa: "EasyPaisa (Legacy)",
    jazzcash: "JazzCash (Legacy)",
    bank: "Bank Transfer (Legacy)",
  };
  return map[method] || method.toUpperCase();
};

const formatDateShort = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

export function AdminPayments() {
  const { orders, fetchOrders, error: ordersError } = useOrders();
  const { settings } = useSettings();
  const [refundAmount, setRefundAmount] = useState(0);
  const [verifiedRevenue, setVerifiedRevenue] = useState(null);
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pendingCodOrders, setPendingCodOrders] = useState([]);
  const [txProviderFilter, setTxProviderFilter] = useState("all");
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [collectingOrderId, setCollectingOrderId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: metaData,
    refresh: refreshMeta,
  } = useSWRCache(META_CACHE_KEY, async () => {
    const [stats, analytics, gateway, txs, pendingCod] = await Promise.all([
      adminAPI.getDashboardStats().catch(() => null),
      adminAPI.getPaymentAnalytics().catch(() => null),
      adminAPI.getPaymentGatewayStatus().catch(() => null),
      adminAPI.getPaymentTransactions({ limit: 80 }).catch(() => []),
      adminAPI.getPendingCodOrders().catch(() => []),
    ]);
    return { stats, analytics, gateway, txs, pendingCod };
  });

  useEffect(() => {
    if (!metaData) return;
    setRefundAmount(Number(metaData.stats?.totalRefundAmount || 0));
    if (metaData.gateway) {
      setGatewayStatus(metaData.gateway);
    }
    if (Array.isArray(metaData.txs)) {
      setTransactions(metaData.txs);
    }
    if (Array.isArray(metaData.pendingCod)) {
      setPendingCodOrders(metaData.pendingCod);
    }
    if (metaData.analytics?.success) {
      setVerifiedRevenue({
        total: Number(metaData.analytics.total_revenue) || 0,
        month: Number(metaData.analytics.month_revenue) || 0,
        today: Number(metaData.analytics.today_revenue) || 0,
        safepayRevenue: Number(metaData.analytics.safepay_revenue) || 0,
        prepaid: Number(metaData.analytics.prepaid_revenue) || 0,
        codAdvance: Number(metaData.analytics.cod_advance_revenue) || 0,
        codFinal: Number(metaData.analytics.cod_final_revenue) || 0,
        pendingCodCollections: Number(metaData.analytics.pending_cod_collections) || 0,
        pendingCodAmount: Number(metaData.analytics.pending_cod_amount) || 0,
      });
    }
  }, [metaData]);

  const refreshAll = useCallback(async () => {
    try {
      setIsRefreshing(true);
      invalidateSWRKey(META_CACHE_KEY);
      await Promise.all([fetchOrders(), refreshMeta()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchOrders, refreshMeta]);

  const handleMarkCodCollected = async (orderId) => {
    try {
      setCollectingOrderId(orderId);
      await adminAPI.markCodCollected(orderId);
      toast.success(`Order #${orderId} COD payment marked as collected.`);
      await refreshAll();
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to mark COD payment as collected",
      );
    } finally {
      setCollectingOrderId(null);
    }
  };

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const provider = String(tx.provider || "").toLowerCase();
        const status = String(tx.status || "pending").toLowerCase();
        if (txProviderFilter !== "all" && provider !== txProviderFilter) return false;
        if (txStatusFilter !== "all" && status !== txStatusFilter) return false;
        return true;
      }),
    [transactions, txProviderFilter, txStatusFilter],
  );

  const metrics = useMemo(() => {
    const paidOrders = orders.filter(
      (order) => String(order.payment_status).toLowerCase() === "paid",
    );
    const fallbackTotal = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );

    const methodsMap = new Map();
    orders.forEach((order) => {
      const key = String(order.payment_method || "unknown").toLowerCase();
      const current = methodsMap.get(key) || { count: 0, amount: 0 };
      methodsMap.set(key, {
        count: current.count + 1,
        amount: current.amount + Number(order.total_amount || 0),
      });
    });

    const paymentMethods = [...methodsMap.entries()]
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalRevenue: verifiedRevenue?.total ?? fallbackTotal,
      thisMonthRevenue: verifiedRevenue?.month ?? 0,
      todayRevenue: verifiedRevenue?.today ?? 0,
      paymentMethods,
    };
  }, [orders, verifiedRevenue]);

  const maxMethodAmount = Math.max(
    ...metrics.paymentMethods.map((item) => item.amount),
    1,
  );

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Payments</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              SafePay online gateway transactions and Cash on Delivery collections.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex h-10 self-end items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:self-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {ordersError ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {ordersError}
          </div>
        ) : null}

        {/* SafePay Gateway Status Banner */}
        {gatewayStatus && (
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
              gatewayStatus.configured
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50"
                : "border-amber-200 bg-amber-50/70"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  gatewayStatus.configured
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">SafePay Payment Gateway</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                      gatewayStatus.configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {gatewayStatus.configured ? "Active" : "Keys Missing"}
                  </span>
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-700 border border-slate-200">
                    {gatewayStatus.environment}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  {gatewayStatus.configured
                    ? `Connected in ${gatewayStatus.environment} mode (${gatewayStatus.currency}). Manual screenshot payments are disabled.`
                    : "Set SAFEPAY_API_KEY, SAFEPAY_SECRET_KEY, and SAFEPAY_WEBHOOK_SECRET in backend/.env to process live/sandbox SafePay checkouts."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                  gatewayStatus.webhook_configured
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Webhook {gatewayStatus.webhook_configured ? "Configured" : "Not Set"}
              </span>
            </div>
          </div>
        )}

        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatPrice(metrics.totalRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">Total Verified Revenue</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Shield className="h-5 w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatPrice(verifiedRevenue?.safepayRevenue ?? 0, settings.currency)}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">SafePay Collected</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatPrice(metrics.thisMonthRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">This Month</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatPrice(refundAmount, settings.currency)}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">Refunded</p>
          </div>
        </div>

        {/* Pending COD Collections */}
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Pending Cash on Delivery Collections ({pendingCodOrders.length})
              </h2>
            </div>
            {verifiedRevenue?.pendingCodAmount > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                Outstanding: {formatPrice(verifiedRevenue.pendingCodAmount, settings.currency)}
              </span>
            )}
          </div>

          {pendingCodOrders.length === 0 ? (
            <p className="text-sm text-slate-500">All Cash on Delivery orders are settled.</p>
          ) : (
            <div className="space-y-3">
              {pendingCodOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        ORD-{String(order.id).padStart(6, "0")}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold capitalize text-slate-700 border border-slate-200">
                        {order.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentStatusClass[order.payment_status] || "bg-slate-100 text-slate-700"}`}
                      >
                        {order.payment_status === "partial" ? "Advance Paid via SafePay" : "COD Pending"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {order.customer_name || order.customer_email || "Customer"} · {order.city || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Placed {formatDateShort(order.created_at)}
                      {order.advance_paid > 0
                        ? ` · Advance Paid: ${formatPrice(order.advance_paid, settings.currency)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">Cash to Collect</p>
                      <p className="text-base font-extrabold text-amber-900">
                        {formatPrice(order.remaining_cash, settings.currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleMarkCodCollected(order.id)}
                      disabled={collectingOrderId === order.id}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {collectingOrderId === order.id ? "Saving..." : "Mark Collected"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gateway Transactions Table + Method Distribution */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6 xl:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Payment Transactions ({filteredTransactions.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                <select
                  value={txProviderFilter}
                  onChange={(e) => setTxProviderFilter(e.target.value)}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="all">All Providers</option>
                  <option value="safepay">SafePay</option>
                  <option value="cod">Cash on Delivery</option>
                </select>
                <select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value)}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No payment transactions match the selected filters.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredTransactions.map((tx) => {
                  const status = String(tx.status || "pending").toLowerCase();
                  return (
                    <div
                      key={tx.id}
                      className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-[#f6fbf7] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {tx.order_id ? `ORD-${String(tx.order_id).padStart(6, "0")}` : `TX #${tx.id}`}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                            {formatMethodLabel(tx.provider)}
                          </span>
                          {tx.stage && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                              {tx.stage === "advance_shipping"
                                ? "COD Advance"
                                : tx.stage === "final_collection"
                                  ? "COD Cash"
                                  : "Full Payment"}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          {tx.customer_name || tx.user_name || tx.customer_email || "Customer"} ·{" "}
                          {formatDateShort(tx.processed_at || tx.created_at)}
                        </p>
                        {tx.gateway_reference && (
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                            Ref: {tx.gateway_reference}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                        <p className="text-sm font-extrabold text-slate-900">
                          {formatPrice(Number(tx.amount || 0), tx.currency || settings.currency)}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${paymentStatusClass[status] || "bg-slate-100 text-slate-700"}`}
                        >
                          {status || "recorded"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Payment Methods Breakdown</h2>
            <div className="space-y-4">
              {metrics.paymentMethods.length > 0 ? (
                metrics.paymentMethods.map((method) => {
                  const widthPercentage = Math.max(
                    (method.amount / maxMethodAmount) * 100,
                    5,
                  );
                  return (
                    <div key={method.method}>
                      <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{formatMethodLabel(method.method)}</span>
                        <span>{formatPrice(method.amount, settings.currency)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-emerald-100/70">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#245418] to-[#65a63f]"
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {method.count} order{method.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No order payment data yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
