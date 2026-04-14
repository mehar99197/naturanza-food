import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { useOrders } from "@/context/OrderContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { adminAPI } from "@/services/api";

const paymentStatusClass = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

const formatMethodLabel = (value) => {
  const method = String(value || "unknown").toLowerCase();
  const map = {
    cod: "Cash on Delivery",
    card: "Card",
    online: "Online",
    easypaisa: "EasyPaisa",
    jazzcash: "JazzCash",
    paypal: "PayPal",
  };

  return map[method] || method.toUpperCase();
};

export function AdminPayments() {
  const { orders, loading: ordersLoading, fetchOrders } = useOrders();
  const { settings } = useSettings();
  const [refundAmount, setRefundAmount] = useState(0);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [mobileView, setMobileView] = useState("transactions");
  const [showAllMobileMethods, setShowAllMobileMethods] = useState(false);
  const [showAllMobileTransactions, setShowAllMobileTransactions] = useState(false);

  const loadMeta = async () => {
    try {
      setError("");
      const stats = await adminAPI.getDashboardStats();
      setRefundAmount(Number(stats?.totalRefundAmount || 0));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load payment analytics",
      );
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  const refreshAll = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchOrders(), loadMeta()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const metrics = useMemo(() => {
    const paidOrders = orders.filter((order) => String(order.payment_status).toLowerCase() === "paid");
    const totalRevenue = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const thisMonthRevenue = paidOrders
      .filter((order) => {
        const date = new Date(order.order_date || order.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    const todayRevenue = paidOrders
      .filter((order) => {
        const date = new Date(order.order_date || order.created_at);
        return (
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        );
      })
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

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

    const recentTransactions = [...orders]
      .sort(
        (a, b) =>
          new Date(b.order_date || b.created_at) -
          new Date(a.order_date || a.created_at),
      )
      .slice(0, 12);

    return {
      totalRevenue,
      thisMonthRevenue,
      todayRevenue,
      paymentMethods,
      recentTransactions,
    };
  }, [orders]);

  const quickSummaryItems = useMemo(
    () => [
      { key: "total", label: "Revenue", value: formatPrice(metrics.totalRevenue, settings.currency) },
      { key: "month", label: "Month", value: formatPrice(metrics.thisMonthRevenue, settings.currency) },
      { key: "today", label: "Today", value: formatPrice(metrics.todayRevenue, settings.currency) },
      { key: "refund", label: "Refund", value: formatPrice(refundAmount, settings.currency) },
    ],
    [metrics.thisMonthRevenue, metrics.todayRevenue, metrics.totalRevenue, refundAmount, settings.currency],
  );

  const mobilePaymentMethods = useMemo(
    () =>
      showAllMobileMethods
        ? metrics.paymentMethods
        : metrics.paymentMethods.slice(0, 3),
    [metrics.paymentMethods, showAllMobileMethods],
  );

  const mobileTransactions = useMemo(
    () =>
      showAllMobileTransactions
        ? metrics.recentTransactions
        : metrics.recentTransactions.slice(0, 4),
    [metrics.recentTransactions, showAllMobileTransactions],
  );

  const maxMethodAmount = Math.max(
    ...metrics.paymentMethods.map((item) => item.amount),
    1,
  );

  if (ordersLoading || metaLoading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={4} showCharts rows={8} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 sm:text-3xl">Payments</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Live payment and revenue data from real orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex h-9 self-end items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:self-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? "animate-spin" : ""}`} />
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

        <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(metrics.totalRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Total Revenue</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(metrics.thisMonthRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">This Month</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(metrics.todayRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Today</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(refundAmount, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Refunded</p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-gray-900">
                {mobileView === "methods" ? "Payment Methods" : "Recent Transactions"}
              </h2>
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setMobileView("methods")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileView === "methods" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
                  }`}
                >
                  Methods
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView("transactions")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileView === "transactions" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
                  }`}
                >
                  Txns
                </button>
              </div>
            </div>

            {mobileView === "methods" ? (
              <div className="space-y-3">
                {mobilePaymentMethods.length > 0 ? (
                  mobilePaymentMethods.map((method) => {
                    const widthPercentage = Math.max((method.amount / maxMethodAmount) * 100, 5);
                    return (
                      <div key={method.method} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-700">
                          <span>{formatMethodLabel(method.method)}</span>
                          <span>{formatPrice(method.amount, settings.currency)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-[#245418] to-[#65a63f]"
                            style={{ width: `${widthPercentage}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{method.count} transactions</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No payment data available.</p>
                )}

                {metrics.paymentMethods.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileMethods((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {showAllMobileMethods ? "Show fewer methods" : `Show all ${metrics.paymentMethods.length} methods`}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2.5">
                {mobileTransactions.length > 0 ? (
                  mobileTransactions.map((order) => {
                    const paymentStatus = String(order.payment_status || "pending").toLowerCase();
                    return (
                      <article key={order.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              #{order.id} · {order.customer_name || order.customer_email || "Customer"}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {formatMethodLabel(order.payment_method)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${paymentStatusClass[paymentStatus] || "bg-gray-100 text-gray-700"}`}
                          >
                            {paymentStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-right text-sm font-bold text-gray-900">
                          {formatPrice(Number(order.total_amount || 0), settings.currency)}
                        </p>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No transactions found.</p>
                )}

                {metrics.recentTransactions.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileTransactions((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {showAllMobileTransactions
                      ? "Show fewer transactions"
                      : `Show all ${metrics.recentTransactions.length} transactions`}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Payment Methods</h2>
            <div className="space-y-4">
              {metrics.paymentMethods.length > 0 ? (
                metrics.paymentMethods.map((method) => {
                  const widthPercentage = Math.max((method.amount / maxMethodAmount) * 100, 5);
                  return (
                    <div key={method.method}>
                      <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-gray-700">
                        <span>{formatMethodLabel(method.method)}</span>
                        <span>{formatPrice(method.amount, settings.currency)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#245418] to-[#65a63f]"
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{method.count} transactions</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No payment data available.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Recent Transactions</h2>
            {ordersLoading ? (
              <p className="text-sm text-gray-500">Loading transactions...</p>
            ) : (
              <div className="space-y-3">
                {metrics.recentTransactions.length > 0 ? (
                  metrics.recentTransactions.map((order) => {
                    const paymentStatus = String(order.payment_status || "pending").toLowerCase();
                    return (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            #{order.id} · {order.customer_name || order.customer_email || "Customer"}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {formatMethodLabel(order.payment_method)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {formatPrice(Number(order.total_amount || 0), settings.currency)}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${paymentStatusClass[paymentStatus] || "bg-gray-100 text-gray-700"}`}
                          >
                            {paymentStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No transactions found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
