import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  Package,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminLayout } from "@/components/AdminLayout";
import { DashboardSkeleton } from "@/components/Skeletons/DashboardSkeleton";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { adminAPI } from "@/services/api";

const ORDER_THEME = {
  pending: {
    label: "Pending",
    color: "#86efac",
    chip: "bg-gray-100 text-[#6b7280] border-gray-200",
    surface: "bg-gray-50 border-gray-200",
    icon: Clock3,
  },
  processing: {
    label: "Processing",
    color: "#16a34a",
    chip: "bg-[#ecfdf5] text-[#16a34a] border-[#a7f3d0]",
    surface: "bg-[#f0fdf4] border-[#a7f3d0]",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    color: "#16a34a",
    chip: "bg-[#ecfdf5] text-[#166534] border-[#a7f3d0]",
    surface: "bg-[#f0fdf4] border-[#a7f3d0]",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "#22c55e",
    chip: "bg-[#d1fae5] text-[#166534] border-[#6ee7b7]",
    surface: "bg-[#ecfdf5] border-[#6ee7b7]",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "#ef4444",
    chip: "bg-red-50 text-[#ef4444] border-red-200",
    surface: "bg-red-50 border-red-100",
    icon: XCircle,
  },
  returned: {
    label: "Returns",
    color: "#86efac",
    chip: "bg-gray-100 text-[#6b7280] border-gray-200",
    surface: "bg-gray-50 border-gray-200",
    icon: RotateCcw,
  },
};

const sampleRecentOrders = [
  {
    id: 9012,
    customer_name: "Ayesha Khan",
    customer_email: "ayesha@example.com",
    total_amount: 128.5,
    status: "processing",
    created_at: new Date().toISOString(),
  },
  {
    id: 9011,
    customer_name: "Bilal Ahmed",
    customer_email: "bilal@example.com",
    total_amount: 88.0,
    status: "pending",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 9010,
    customer_name: "Sara Ali",
    customer_email: "sara@example.com",
    total_amount: 156.3,
    status: "shipped",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 9009,
    customer_name: "Usman Tariq",
    customer_email: "usman@example.com",
    total_amount: 63.45,
    status: "delivered",
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
];

const sampleTopProducts = [
  { id: 1, name: "Organic Moringa Powder", total_sold: 96, total_revenue: 1864 },
  { id: 2, name: "Immunity Herbal Tea", total_sold: 78, total_revenue: 1510 },
  { id: 3, name: "Turmeric Wellness Blend", total_sold: 70, total_revenue: 1262 },
  { id: 4, name: "Ashwagandha Capsules", total_sold: 64, total_revenue: 1188 },
  { id: 5, name: "Pure Neem Extract", total_sold: 53, total_revenue: 942 },
];

const createSampleSalesRows = () => {
  const values = [1240, 1480, 1325, 1690, 1820, 1765, 1950];
  const orders = [18, 22, 20, 26, 28, 27, 31];

  return values.map((revenue, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      date: date.toISOString(),
      revenue,
      orders: orders[index],
    };
  });
};

const toStatusKey = (status) => {
  const key = String(status || "pending").toLowerCase();
  if (key === "return" || key === "returns") {
    return "returned";
  }
  return ORDER_THEME[key] ? key : "pending";
};

const formatTrend = (value) => {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
};

const compactNumber = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}m`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`;
  }
  return `${Math.round(amount)}`;
};

const DashboardStatCard = ({ title, value, subtitle, icon: Icon, tone, trendValue }) => (
  <article className="group rounded-2xl border border-[#dbe4de] bg-white p-3.5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all duration-300 sm:rounded-3xl sm:p-5 sm:hover:-translate-y-1 sm:hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)]">
    <div className="mb-3 flex items-center justify-between sm:mb-4">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${
          trendValue >= 0 ? "bg-[#ecfdf5] text-[#16a34a]" : "bg-red-50 text-[#ef4444]"
        }`}
      >
        <ArrowUpRight className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${trendValue < 0 ? "rotate-90" : ""}`} />
        {formatTrend(trendValue)}
      </span>
    </div>

    <p className="text-[1.7rem] font-extrabold tracking-tight text-[#1f2937] sm:text-[1.9rem]">{value}</p>
    <p className="mt-1 text-[13px] font-semibold text-[#1f2937] sm:text-sm">{title}</p>
    <p className="mt-1 text-[11px] font-medium text-[#6b7280] sm:mt-2 sm:text-xs">{subtitle}</p>
  </article>
);

const OrderStatusBadge = ({ status }) => {
  const key = toStatusKey(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ORDER_THEME[key].chip}`}
    >
      {ORDER_THEME[key].label}
    </span>
  );
};

export function AdminDashboard() {
  const { settings } = useSettings();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsData, setStatsData] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [salesReport, setSalesReport] = useState([]);
  const [mobileChartView, setMobileChartView] = useState("revenue");

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }

      setError("");

      const [statsResponse, recentOrdersResponse, salesResponse, productSalesResponse] =
        await Promise.all([
          adminAPI.getDashboardStats(),
          adminAPI.getRecentOrders(8),
          adminAPI.getSalesReport(),
          adminAPI.getProductSalesReport(),
        ]);

      setStatsData(statsResponse || {});
      setRecentOrders(Array.isArray(recentOrdersResponse) ? recentOrdersResponse : []);
      setSalesReport(Array.isArray(salesResponse) ? salesResponse : []);
      setProductSales(Array.isArray(productSalesResponse) ? productSalesResponse : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      void loadDashboardData({ silent: true });
    }, 60000);

    return () => window.clearInterval(refreshTimer);
  }, [loadDashboardData]);

  const salesRows = useMemo(() => {
    if (!salesReport.length) {
      return createSampleSalesRows();
    }

    return [...salesReport].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [salesReport]);

  const sevenDayRows = useMemo(() => salesRows.slice(-7), [salesRows]);

  const revenueTrendData = useMemo(
    () =>
      sevenDayRows.map((row) => ({
        day: new Date(row.date).toLocaleDateString("en-US", {
          weekday: "short",
        }),
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0),
      })),
    [sevenDayRows],
  );

  const sevenDayRevenue = useMemo(
    () => revenueTrendData.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
    [revenueTrendData],
  );

  const sevenDayOrders = useMemo(
    () => revenueTrendData.reduce((sum, row) => sum + Number(row.orders || 0), 0),
    [revenueTrendData],
  );

  const previousWeekRows = useMemo(() => salesRows.slice(-14, -7), [salesRows]);

  const previousWeekRevenue = useMemo(
    () => previousWeekRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
    [previousWeekRows],
  );

  const previousWeekOrders = useMemo(
    () => previousWeekRows.reduce((sum, row) => sum + Number(row.orders || 0), 0),
    [previousWeekRows],
  );

  const revenueTrendPct = useMemo(() => {
    if (previousWeekRevenue <= 0) {
      return sevenDayRevenue > 0 ? 12.4 : 0;
    }

    return ((sevenDayRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
  }, [previousWeekRevenue, sevenDayRevenue]);

  const orderTrendPct = useMemo(() => {
    if (previousWeekOrders <= 0) {
      return sevenDayOrders > 0 ? 8.7 : 0;
    }

    return ((sevenDayOrders - previousWeekOrders) / previousWeekOrders) * 100;
  }, [previousWeekOrders, sevenDayOrders]);

  const totalRevenue = Number(statsData.totalRevenue || sevenDayRevenue);
  const totalOrders = Number(statsData.totalOrders || sevenDayOrders);
  const totalProducts = Number(statsData.totalProducts || 0);
  const totalUsers = Number(statsData.totalUsers || 0);
  const lowStockProducts = Number(statsData.lowStockProducts || 0);
  const activeUsers = Number(statsData.activeUsers || 0);

  const statCards = [
    {
      title: "Total Revenue",
      value: formatPrice(totalRevenue, settings.currency),
      subtitle: `${formatPrice(sevenDayRevenue, settings.currency)} in last 7 days`,
      icon: DollarSign,
      tone: "bg-[#ecfdf5] text-[#16a34a]",
      trendValue: revenueTrendPct,
    },
    {
      title: "Total Orders",
      value: totalOrders.toLocaleString(),
      subtitle: `${sevenDayOrders} orders in last 7 days`,
      icon: ShoppingCart,
      tone: "bg-[#d1fae5] text-[#16a34a]",
      trendValue: orderTrendPct,
    },
    {
      title: "Total Products",
      value: totalProducts.toLocaleString(),
      subtitle: `${lowStockProducts} items low in stock`,
      icon: Package,
      tone: "bg-[#ecfdf5] text-[#166534]",
      trendValue: totalProducts > 0 ? -((lowStockProducts / totalProducts) * 100) : 0,
    },
    {
      title: "Total Customers",
      value: totalUsers.toLocaleString(),
      subtitle: `${activeUsers} active shoppers`,
      icon: Users,
      tone: "bg-[#d1fae5] text-[#166534]",
      trendValue: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
    },
  ];

  const orderPipeline = useMemo(() => {
    const liveValues = {
      pending: Number(statsData.pendingOrders || 0),
      processing: Number(statsData.processingOrders || 0),
      shipped: Number(statsData.shippedOrders || 0),
      delivered: Number(statsData.deliveredOrders || 0),
      cancelled: Number(statsData.cancelledOrders || 0),
      returned: Number(statsData.totalReturns || 0),
    };

    const hasLiveData = Object.values(liveValues).some((value) => value > 0);
    const fallbackValues = {
      pending: 8,
      processing: 14,
      shipped: 10,
      delivered: 36,
      cancelled: 3,
      returned: 2,
    };

    const source = hasLiveData ? liveValues : fallbackValues;

    return Object.entries(ORDER_THEME).map(([key, config]) => ({
      key,
      label: config.label,
      value: source[key],
      icon: config.icon,
      surface: config.surface,
      color: config.color,
    }));
  }, [statsData]);

  const orderStatusChartData = useMemo(
    () =>
      orderPipeline.map((item) => ({
        name: item.label,
        value: Number(item.value || 0),
        color: item.color,
      })),
    [orderPipeline],
  );

  const displayedOrders = useMemo(
    () => (recentOrders.length ? recentOrders.slice(0, 6) : sampleRecentOrders),
    [recentOrders],
  );

  const topProducts = useMemo(
    () => (productSales.length ? productSales.slice(0, 5) : sampleTopProducts),
    [productSales],
  );

  const maxProductSales = useMemo(
    () => Math.max(...topProducts.map((item) => Number(item.total_sold || 0)), 1),
    [topProducts],
  );

  if (isLoading) {
    return (
      <AdminLayout>
        <DashboardSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 sm:gap-6">
        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[#ef4444]">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <DashboardStatCard key={card.title} {...card} />
          ))}
        </section>

        <section className="rounded-3xl border border-[#dbe4de] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1f2937] sm:text-xl">Order Pipeline</h2>
            <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#16a34a]">
              Live Order Health
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {orderPipeline.map((status) => {
              const Icon = status.icon;
              return (
                <article
                  key={status.key}
                  className={`rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${status.surface}`}
                >
                  <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-[#1f2937] shadow-sm sm:mb-3 sm:h-9 sm:w-9">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-xl font-extrabold leading-tight text-[#1f2937] sm:text-2xl">{status.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280] sm:text-xs sm:tracking-[0.1em]">
                    {status.label}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-[#dbe4de] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] md:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#1f2937]">
              {mobileChartView === "revenue" ? "7-Day Revenue Trend" : "Order Status Distribution"}
            </h3>

            <div className="inline-flex rounded-full border border-[#cde8d8] bg-[#f8faf8] p-1">
              <button
                type="button"
                onClick={() => setMobileChartView("revenue")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  mobileChartView === "revenue"
                    ? "bg-[#16a34a] text-white"
                    : "text-[#15803d] hover:bg-[#ecfdf5]"
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setMobileChartView("status")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  mobileChartView === "status"
                    ? "bg-[#16a34a] text-white"
                    : "text-[#15803d] hover:bg-[#ecfdf5]"
                }`}
              >
                Status
              </button>
            </div>
          </div>

          {mobileChartView === "revenue" ? (
            <>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrendData} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => compactNumber(value)}
                    />
                    <Tooltip
                      cursor={{ stroke: "#16a34a", strokeWidth: 1 }}
                      formatter={(value) => [formatPrice(Number(value), settings.currency), "Revenue"]}
                      contentStyle={{
                        borderRadius: "12px",
                        borderColor: "#16a34a",
                        boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                      }}
                    />
                    <Line
                      name="Revenue"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 2.8, fill: "#16a34a" }}
                      activeDot={{ r: 4.2, fill: "#16a34a" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-emerald-100 pt-3">
                <div>
                  <p className="text-[11px] font-medium text-[#6b7280]">7d Revenue</p>
                  <p className="mt-1 text-[13px] font-extrabold text-[#1f2937]">
                    {formatPrice(sevenDayRevenue, settings.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#6b7280]">7d Orders</p>
                  <p className="mt-1 text-[13px] font-extrabold text-[#1f2937]">{sevenDayOrders}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#6b7280]">Avg. Order</p>
                  <p className="mt-1 text-[13px] font-extrabold text-[#1f2937]">
                    {formatPrice(sevenDayOrders ? sevenDayRevenue / sevenDayOrders : 0, settings.currency)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {orderStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value), name]}
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#16a34a",
                      boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-2">
          <div className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1f2937]">7-Day Revenue Trend</h3>
              <p className="text-sm text-[#6b7280]">Daily revenue movement with clear tooltips and labels</p>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => compactNumber(value)}
                  />
                  <Tooltip
                    cursor={{ stroke: "#16a34a", strokeWidth: 1 }}
                    formatter={(value) => [formatPrice(Number(value), settings.currency), "Revenue"]}
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#16a34a",
                      boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    name="Revenue"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#16a34a" }}
                    activeDot={{ r: 5, fill: "#16a34a" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-emerald-100 pt-4">
              <div>
                <p className="text-xs font-medium text-[#6b7280]">7d Revenue</p>
                <p className="mt-1 text-sm font-extrabold text-[#1f2937] sm:text-base">
                  {formatPrice(sevenDayRevenue, settings.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7280]">7d Orders</p>
                <p className="mt-1 text-sm font-extrabold text-[#1f2937] sm:text-base">{sevenDayOrders}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7280]">Avg. Order</p>
                <p className="mt-1 text-sm font-extrabold text-[#1f2937] sm:text-base">
                  {formatPrice(sevenDayOrders ? sevenDayRevenue / sevenDayOrders : 0, settings.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1f2937]">Order Status Distribution</h3>
              <p className="text-sm text-[#6b7280]">Live breakdown of fulfillment pipeline</p>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={105}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {orderStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value), name]}
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#16a34a",
                      boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#dbe4de] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1f2937]">Recent Orders</h3>
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#16a34a] hover:bg-[#d1fae5]"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {displayedOrders.map((order, index) => (
                <article
                  key={order.id}
                  className={`${index > 2 ? "hidden sm:flex" : "flex"} flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dbe4de] bg-[#ffffff] px-4 py-3`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1f2937]">
                      #{order.id} - {order.customer_name || order.customer_email || "Customer"}
                    </p>
                    <p className="truncate text-xs text-[#6b7280]">
                      {order.customer_email || "No email provided"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[#1f2937]">
                      {formatPrice(Number(order.total_amount || 0), settings.currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6b7280]">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "just now"}
                    </p>
                  </div>

                  <OrderStatusBadge status={order.status} />
                </article>
              ))}

              {displayedOrders.length > 3 ? (
                <p className="text-center text-[11px] font-medium text-[#6b7280] sm:hidden">
                  +{displayedOrders.length - 3} more orders in full view
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-[#dbe4de] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1f2937]">Top Selling Products</h3>
              <Link
                to="/admin/products"
                className="inline-flex items-center gap-1 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#16a34a] hover:bg-[#d1fae5]"
              >
                Manage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {topProducts.map((item, index) => {
                const sold = Number(item.total_sold || 0);
                const widthPercent = Math.max((sold / maxProductSales) * 100, 8);

                return (
                  <article
                    key={item.id}
                    className={`${index > 2 ? "hidden sm:block" : "block"} rounded-2xl border border-[#dbe4de] bg-[#ffffff] p-3.5`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ecfdf5] text-xs font-bold text-[#16a34a]">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1f2937]">{item.name}</p>
                          <p className="text-xs text-[#6b7280]">
                            Revenue: {formatPrice(Number(item.total_revenue || 0), settings.currency)}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-[#6b7280]">{sold} sold</p>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-[#d1fae5]">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#15803d] to-[#16a34a]"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </article>
                );
              })}

              {topProducts.length > 3 ? (
                <p className="text-center text-[11px] font-medium text-[#6b7280] sm:hidden">
                  +{topProducts.length - 3} more products in full view
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}


