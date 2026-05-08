import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, FileBarChart2, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { adminAPI } from "@/services/api";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { BarChart, LineChart } from "@/components/Charts";

const formatDateLabel = (dateValue) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateValue));

const formatTableDate = (dateValue) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));

const buildRangeParams = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
};

export function AdminReports() {
  const { settings } = useSettings();

  const [daysRange, setDaysRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesRows, setSalesRows] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const [stats, setStats] = useState({});
  const [mobileChartView, setMobileChartView] = useState("revenue");
  const [mobileDataView, setMobileDataView] = useState("sales");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [showAllMobileProducts, setShowAllMobileProducts] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [salesResponse, productResponse, statsResponse] = await Promise.all([
        adminAPI.getSalesReport(buildRangeParams(daysRange)),
        adminAPI.getProductSalesReport(),
        adminAPI.getDashboardStats(),
      ]);

      setSalesRows(Array.isArray(salesResponse) ? salesResponse : []);
      setProductRows(Array.isArray(productResponse) ? productResponse : []);
      setStats(statsResponse || {});
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load reports",
      );
    } finally {
      setLoading(false);
    }
  }, [daysRange]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const sortedForCharts = useMemo(
    () => [...salesRows].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [salesRows],
  );

  const sortedForTable = useMemo(
    () => [...salesRows].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [salesRows],
  );

  const totals = useMemo(() => {
    const revenue = salesRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const orders = salesRows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
    const aov = orders > 0 ? revenue / orders : 0;

    return {
      revenue,
      orders,
      aov,
    };
  }, [salesRows]);

  const chartLabels = sortedForCharts.map((row) => formatDateLabel(row.date));
  const revenueSeries = sortedForCharts.map((row) => Number(row.revenue || 0));
  const ordersSeries = sortedForCharts.map((row) => Number(row.orders || 0));

  const mobileOrdersAxis = useMemo(() => {
    const peakOrders = Math.max(0, ...ordersSeries);
    const max =
      peakOrders <= 5 ? 5 : peakOrders <= 10 ? 10 : peakOrders <= 20 ? 20 : Math.ceil(peakOrders / 10) * 10;

    const stepSize = max === 5 ? 1 : max === 10 ? 2 : max === 20 ? 5 : Math.max(5, Math.ceil(max / 6));

    return { max, stepSize };
  }, [ordersSeries]);

  const quickSummaryItems = useMemo(
    () => [
      { key: "rev", label: `Revenue (${daysRange}d)`, value: formatPrice(totals.revenue, settings.currency) },
      { key: "orders", label: `Orders (${daysRange}d)`, value: totals.orders },
      { key: "aov", label: "Avg", value: formatPrice(totals.aov, settings.currency) },
      {
        key: "refund",
        label: "Refund",
        value: formatPrice(Number(stats.totalRefundAmount || 0), settings.currency),
      },
    ],
    [daysRange, settings.currency, stats.totalRefundAmount, totals.aov, totals.orders, totals.revenue],
  );

  const mobileSalesRows = useMemo(
    () => (showAllMobileRows ? sortedForTable : sortedForTable.slice(0, 5)),
    [showAllMobileRows, sortedForTable],
  );

  const mobileProductRows = useMemo(
    () =>
      showAllMobileProducts
        ? productRows.slice(0, 10)
        : productRows.slice(0, 4),
    [productRows, showAllMobileProducts],
  );

  useEffect(() => {
    setShowAllMobileRows(false);
    setShowAllMobileProducts(false);
  }, [daysRange]);

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={4} rows={8} showCharts />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Reports</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Real sales reports generated from orders and product sales tables.
            </p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <select
              value={daysRange}
              onChange={(event) => setDaysRange(Number(event.target.value))}
              className="h-10 flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-11 sm:flex-none sm:rounded-2xl"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-sm font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="grid grid-cols-2 gap-2">
              {quickSummaryItems.map((item) => (
                <article key={item.key} className="rounded-xl border border-emerald-100 bg-[#f7fbf7] px-2.5 py-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {item.label}
                  </p>
                  <p className={`mt-0.5 truncate text-sm font-extrabold ${item.key === "refund" ? "text-red-700" : "text-slate-900"}`}>
                    {item.value}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue ({daysRange}d)</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatPrice(totals.revenue, settings.currency)}
            </p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders ({daysRange}d)</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totals.orders}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Order Value</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatPrice(totals.aov, settings.currency)}
            </p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refunded Amount</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {formatPrice(Number(stats.totalRefundAmount || 0), settings.currency)}
            </p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {mobileChartView === "revenue" ? "Revenue Trend" : "Orders Trend"}
              </h2>
              <div className="inline-flex rounded-full border border-emerald-100 bg-[#f4faf5] p-1">
                <button
                  type="button"
                  onClick={() => setMobileChartView("revenue")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "revenue" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setMobileChartView("orders")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "orders" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Orders
                </button>
              </div>
            </div>

            {mobileChartView === "revenue" ? (
              <LineChart
                title="Revenue Trend"
                labels={chartLabels}
                datasets={[
                  {
                    label: "Revenue",
                    data: revenueSeries,
                    borderColor: "#166534",
                    backgroundColor: "rgba(22, 101, 52, 0.12)",
                    fill: true,
                  },
                ]}
                options={{
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      ticks: { maxTicksLimit: 5 },
                    },
                  },
                }}
                height={220}
              />
            ) : (
              <BarChart
                title="Orders Trend"
                labels={chartLabels}
                datasets={[
                  {
                    label: "Orders",
                    data: ordersSeries,
                    backgroundColor: "#65a63f",
                    borderColor: "#3f7d2b",
                    maxBarThickness: 18,
                  },
                ]}
                options={{
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      ticks: { maxTicksLimit: 5 },
                    },
                    y: {
                      beginAtZero: true,
                      max: mobileOrdersAxis.max,
                      ticks: { stepSize: mobileOrdersAxis.stepSize },
                    },
                  },
                }}
                height={220}
              />
            )}
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <LineChart
              title="Revenue by Day"
              labels={chartLabels}
              datasets={[
                {
                  label: "Revenue",
                  data: revenueSeries,
                  borderColor: "#166534",
                  backgroundColor: "rgba(22, 101, 52, 0.12)",
                  fill: true,
                },
              ]}
              options={{
                plugins: {
                  legend: { display: false },
                },
              }}
              height={240}
            />
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <BarChart
              title="Orders by Day"
              labels={chartLabels}
              datasets={[
                {
                  label: "Orders",
                  data: ordersSeries,
                  backgroundColor: "#65a63f",
                  borderColor: "#3f7d2b",
                },
              ]}
              options={{
                plugins: {
                  legend: { display: false },
                },
              }}
              height={240}
            />
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {mobileDataView === "sales" ? "Daily Sales" : "Top Product Revenue"}
              </h2>
              <div className="inline-flex rounded-full border border-emerald-100 bg-[#f4faf5] p-1">
                <button
                  type="button"
                  onClick={() => setMobileDataView("sales")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileDataView === "sales" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Sales
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDataView("products")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileDataView === "products" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Products
                </button>
              </div>
            </div>

            {mobileDataView === "sales" ? (
              <div className="space-y-2.5">
                {mobileSalesRows.length > 0 ? (
                  mobileSalesRows.map((row) => (
                    <article
                      key={row.date}
                      className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{formatTableDate(row.date)}</p>
                        <span className="text-xs font-semibold text-slate-500">
                          {Number(row.orders || 0)} orders
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span>{formatPrice(Number(row.revenue || 0), settings.currency)}</span>
                        <span>AOV {formatPrice(Number(row.average_order_value || 0), settings.currency)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-3 text-sm text-slate-500">
                    No sales data found for selected period.
                  </p>
                )}

                {sortedForTable.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileRows((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    {showAllMobileRows
                      ? "Show fewer rows"
                      : `Show all ${sortedForTable.length} rows`}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2.5">
                {mobileProductRows.length > 0 ? (
                  mobileProductRows.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-2.5"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span>{Number(item.total_sold || 0)} sold</span>
                        <span>{formatPrice(Number(item.total_revenue || 0), settings.currency)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-3 text-sm text-slate-500">
                    No product sales records available.
                  </p>
                )}

                {productRows.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileProducts((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    {showAllMobileProducts
                      ? "Show fewer products"
                      : `Show all ${Math.min(productRows.length, 10)} products`}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-[58%_42%]">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <div className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileBarChart2 className="h-5 w-5 text-slate-500" />
              Daily Sales Breakdown
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-emerald-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-3">Date</th>
                    <th className="pb-3 pr-3">Orders</th>
                    <th className="pb-3 pr-3">Revenue</th>
                    <th className="pb-3">Avg Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedForTable.length > 0 ? (
                    sortedForTable.map((row) => (
                      <tr key={row.date} className="border-b border-emerald-100/70">
                        <td className="py-3 pr-3 text-sm font-semibold text-slate-900">
                          {formatTableDate(row.date)}
                        </td>
                        <td className="py-3 pr-3 text-sm text-slate-700">{Number(row.orders || 0)}</td>
                        <td className="py-3 pr-3 text-sm text-slate-700">
                          {formatPrice(Number(row.revenue || 0), settings.currency)}
                        </td>
                        <td className="py-3 text-sm text-slate-700">
                          {formatPrice(Number(row.average_order_value || 0), settings.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                        No sales data found for selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <p className="mb-4 text-lg font-bold text-slate-900">Top Product Revenue</p>
            <div className="space-y-3">
              {productRows.length > 0 ? (
                productRows.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-3"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{Number(item.total_sold || 0)} sold</span>
                      <span>
                        {formatPrice(Number(item.total_revenue || 0), settings.currency)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  No product sales records available.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
