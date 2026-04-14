import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
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

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={4} showCharts />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 sm:text-3xl">Analytics</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Live sales and performance insights from your backend database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex h-9 self-end items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:self-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
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

        <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(totals.totalRevenue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Total Revenue</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{totals.totalOrders}</p>
            <p className="mt-1 text-sm font-medium text-gray-600">Total Orders</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(totals.avgOrderValue, settings.currency)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Avg. Order Value</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">
              {Number(statsData.totalProducts || 0)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">Tracked Products</p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-gray-900">
                {mobileChartView === "revenue"
                  ? "Revenue Trend"
                  : mobileChartView === "orders"
                    ? "Orders Trend"
                    : "Top Product Share"}
              </h2>
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setMobileChartView("revenue")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "revenue" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
                  }`}
                >
                  Rev
                </button>
                <button
                  type="button"
                  onClick={() => setMobileChartView("orders")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "orders" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
                  }`}
                >
                  Ord
                </button>
                <button
                  type="button"
                  onClick={() => setMobileChartView("share")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileChartView === "share" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
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
                height={220}
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
                height={200}
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
                height={220}
              />
            ) : null}
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
              }}
              height={320}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <BarChart
              title="Orders Trend"
              labels={chartLabels}
              datasets={[
                {
                  label: "Orders",
                  data: orderSeries,
                  backgroundColor: "#65a63f",
                  borderColor: "#3f7d2b",
                },
              ]}
              options={{
                plugins: {
                  legend: { display: false },
                },
              }}
              height={320}
            />
          </div>
        </div>

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">Top Products</h2>
            <div className="space-y-2">
              {mobileTopProducts.length > 0 ? (
                mobileTopProducts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                      <span>{Number(item.total_sold || 0)} sold</span>
                      <span>{formatPrice(Number(item.total_revenue || 0), settings.currency)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No product analytics available yet.</p>
              )}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
              height={320}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Top Products</h2>
            <div className="space-y-3">
              {topProducts.length > 0 ? (
                topProducts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                      <span>{Number(item.total_sold || 0)} sold</span>
                      <span>{formatPrice(Number(item.total_revenue || 0), settings.currency)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No product analytics available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
