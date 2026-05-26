import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminAPI } from "@/services/api";
import { formatPrice } from "@/lib/utils";
import { useSettings } from "@/context/SettingsContext";
import { BarChart, LineChart, PieChart } from "@/components/Charts";

export function AdminAnalytics() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsData, setStatsData] = useState({});
  const [salesReport, setSalesReport] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [mobileChartView, setMobileChartView] = useState("revenue");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [statsResponse, salesResponse, productsResponse] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getSalesReport(),
        adminAPI.getProductSalesReport(),
      ]);

      setStatsData(statsResponse || {});
      setSalesReport(Array.isArray(salesResponse) ? salesResponse : []);
      setProductSales(Array.isArray(productsResponse) ? productsResponse : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load analytics data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedSalesReport = useMemo(
    () => [...salesReport].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [salesReport],
  );

  const chartLabels = useMemo(
    () =>
      sortedSalesReport.map((row) =>
        new Date(row.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      ),
    [sortedSalesReport],
  );

  const revenueSeries = useMemo(
    () => sortedSalesReport.map((row) => Number(row.revenue || 0)),
    [sortedSalesReport],
  );

  const orderSeries = useMemo(
    () => sortedSalesReport.map((row) => Number(row.orders || 0)),
    [sortedSalesReport],
  );

  const mobileOrdersAxis = useMemo(() => {
    const peakOrders = Math.max(0, ...orderSeries);
    const max =
      peakOrders <= 5 ? 5 : peakOrders <= 10 ? 10 : peakOrders <= 20 ? 20 : Math.ceil(peakOrders / 10) * 10;

    const stepSize = max === 5 ? 1 : max === 10 ? 2 : max === 20 ? 5 : Math.max(5, Math.ceil(max / 6));

    return { max, stepSize };
  }, [orderSeries]);

  const totals = useMemo(() => {
    const totalRevenue = revenueSeries.reduce((sum, value) => sum + value, 0);
    const totalOrders = orderSeries.reduce((sum, value) => sum + value, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
    };
  }, [orderSeries, revenueSeries]);

  const topProducts = useMemo(() => productSales.slice(0, 6), [productSales]);
  const mobileTopProducts = useMemo(() => topProducts.slice(0, 3), [topProducts]);

  const quickSummaryItems = useMemo(
    () => [
      { key: "revenue", label: "Revenue", value: formatPrice(totals.totalRevenue, settings.currency) },
      { key: "orders", label: "Orders", value: totals.totalOrders },
      { key: "avg", label: "Avg", value: formatPrice(totals.avgOrderValue, settings.currency) },
      { key: "products", label: "Products", value: Number(statsData.totalProducts || 0) },
    ],
    [settings.currency, statsData.totalProducts, totals.avgOrderValue, totals.totalOrders, totals.totalRevenue],
  );

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Analytics</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Live sales and performance insights from your backend database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
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
                  <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">
              {formatPrice(totals.totalRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600">Total Revenue</p>
          </div>

          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{totals.totalOrders}</p>
            <p className="mt-1 text-sm font-medium text-slate-600">Total Orders</p>
          </div>

          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">
              {formatPrice(totals.avgOrderValue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600">Avg. Order Value</p>
          </div>

          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">
              {Number(statsData.totalProducts || 0)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600">Tracked Products</p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {mobileChartView === "revenue"
                  ? "Revenue Trend"
                  : mobileChartView === "orders"
                    ? "Orders Trend"
                    : "Top Product Share"}
              </h2>
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/65 p-1">
                <button
                  type="button"
                  onClick={() => setMobileChartView("revenue")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "revenue"
                      ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                      : "text-slate-600"
                  }`}
                >
                  Rev
                </button>
                <button
                  type="button"
                  onClick={() => setMobileChartView("orders")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "orders"
                      ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                      : "text-slate-600"
                  }`}
                >
                  Ord
                </button>
                <button
                  type="button"
                  onClick={() => setMobileChartView("share")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "share"
                      ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                      : "text-slate-600"
                  }`}
                >
                  Share
                </button>
              </div>
            </div>

            {mobileChartView === "revenue" ? (
              <LineChart
                title=""
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
                options={{ plugins: { legend: { display: false } } }}
                height={200}
              />
            ) : null}

            {mobileChartView === "orders" ? (
              <BarChart
                title=""
                labels={chartLabels}
                datasets={[
                  {
                    label: "Orders",
                    data: orderSeries,
                    backgroundColor: "#65a63f",
                    borderColor: "#3f7d2b",
                    borderRadius: 10,
                    barPercentage: 0.45,
                    categoryPercentage: 0.5,
                    maxBarThickness: 44,
                  },
                ]}
                options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 11 },
                        color: "#6b7280",
                      },
                    },
                    y: {
                      beginAtZero: true,
                      max: mobileOrdersAxis.max,
                      ticks: {
                        precision: 0,
                        stepSize: mobileOrdersAxis.stepSize,
                        font: { size: 11 },
                        color: "#6b7280",
                      },
                      grid: { color: "rgba(148,163,184,0.18)" },
                    },
                  },
                }}
                height={180}
              />
            ) : null}

            {mobileChartView === "share" ? (
              <PieChart
                title=""
                labels={topProducts.map((item) => item.name)}
                data={topProducts.map((item) => Number(item.total_sold || 0))}
                backgroundColor={[
                  "#166534",
                  "#22c55e",
                  "#84cc16",
                  "#0ea5e9",
                  "#f59e0b",
                  "#ef4444",
                ]}
                height={200}
              />
            ) : null}
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
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
                    ticks: { maxTicksLimit: 7, color: "#6b7280" },
                    grid: { display: false },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: { color: "#6b7280" },
                    grid: { color: "rgba(148,163,184,0.18)" },
                  },
                },
              }}
              height={240}
            />
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <BarChart
              title="Orders Trend"
              labels={chartLabels}
              datasets={[
                {
                  label: "Orders",
                  data: orderSeries,
                  backgroundColor: "#65a63f",
                  borderColor: "#3f7d2b",
                  borderRadius: 10,
                  barPercentage: 0.5,
                  categoryPercentage: 0.55,
                  maxBarThickness: 52,
                },
              ]}
              options={{
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 7, color: "#6b7280" },
                  },
                  y: {
                    beginAtZero: true,
                    max: mobileOrdersAxis.max,
                    ticks: {
                      precision: 0,
                      stepSize: mobileOrdersAxis.stepSize,
                      color: "#6b7280",
                    },
                    grid: { color: "rgba(148,163,184,0.18)" },
                  },
                },
              }}
              height={240}
            />
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <h2 className="mb-3 text-base font-bold text-slate-900">Top Products</h2>
            <div className="space-y-2">
              {mobileTopProducts.length > 0 ? (
                mobileTopProducts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-2.5"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{Number(item.total_sold || 0)} sold</span>
                      <span>{formatPrice(Number(item.total_revenue || 0), settings.currency)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No product analytics available yet.</p>
              )}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <PieChart
              title="Top Product Share"
              labels={topProducts.map((item) => item.name)}
              data={topProducts.map((item) => Number(item.total_sold || 0))}
              backgroundColor={[
                "#166534",
                "#22c55e",
                "#84cc16",
                "#0ea5e9",
                "#f59e0b",
                "#ef4444",
              ]}
              height={240}
            />
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Top Products</h2>
            <div className="space-y-3">
              {topProducts.length > 0 ? (
                topProducts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-3"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{Number(item.total_sold || 0)} sold</span>
                      <span>{formatPrice(Number(item.total_revenue || 0), settings.currency)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No product analytics available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
