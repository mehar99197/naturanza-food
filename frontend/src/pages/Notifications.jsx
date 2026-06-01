import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Loader2,
  Package,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { userAPI } from "@/services/api";
import { NoIndexSEO } from "@/components/SEO";

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

// "Just now" / "5m ago" / "2h ago" / "3d ago", then the absolute date.
const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
};

// Bucket a notification into a date section for grouped display.
const dateGroupOf = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  return "Earlier";
};

// Broad category for the filter tabs.
const categoryOf = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("payment")) return "payment";
  if (t.startsWith("order") || t.startsWith("return")) return "order";
  return "other";
};

const iconForType = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("payment_approved")) return CircleCheck;
  if (t.startsWith("payment_rejected")) return CircleAlert;
  if (t.startsWith("order_status") || t.startsWith("order_")) return Package;
  if (t.includes("coupon") || t.includes("promo")) return Tag;
  return ShoppingBag;
};

const accentForType = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("payment_approved")) return "text-emerald-700 bg-emerald-100";
  if (t.startsWith("payment_rejected")) return "text-red-700 bg-red-100";
  if (t.startsWith("order_")) return "text-blue-700 bg-blue-100";
  return "text-emerald-700 bg-emerald-100";
};

const safePayload = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const linkForNotification = (notification) => {
  const payload = safePayload(notification.payload);
  if (payload.order_id) return "/orders";
  return null;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "payment", label: "Payments" },
];

export function Notifications() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await userAPI.getNotifications(100);
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
  }, [isAuthenticated, load]);

  const handleMarkOne = async (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
      ),
    );
    try {
      await userAPI.markNotificationRead(id);
    } catch (err) {
      console.warn("[notifications] mark-read failed:", err?.message);
    }
  };

  const handleMarkAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await userAPI.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })),
      );
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to mark all read");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await userAPI.deleteNotification(id);
    } catch (err) {
      setNotifications(previous); // revert on failure
      setError(err?.response?.data?.error || "Failed to delete notification");
    }
  };

  const handleClearAll = async () => {
    if (clearing || notifications.length === 0) return;
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    setClearing(true);
    const previous = notifications;
    setNotifications([]);
    try {
      await userAPI.clearNotifications();
    } catch (err) {
      setNotifications(previous);
      setError(err?.response?.data?.error || "Failed to clear notifications");
    } finally {
      setClearing(false);
    }
  };

  const handleItemClick = (notif) => {
    if (!notif.is_read) void handleMarkOne(notif.id);
    const link = linkForNotification(notif);
    if (link) navigate(link);
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  const counts = useMemo(
    () => ({
      all: notifications.length,
      unread: unreadCount,
      order: notifications.filter((n) => categoryOf(n.type) === "order").length,
      payment: notifications.filter((n) => categoryOf(n.type) === "payment").length,
    }),
    [notifications, unreadCount],
  );

  // Filtered list, then grouped by date section (preserving the desc order).
  const groupedNotifications = useMemo(() => {
    const filtered = notifications.filter((n) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unread") return !n.is_read;
      return categoryOf(n.type) === activeFilter;
    });

    const order = [];
    const map = {};
    for (const n of filtered) {
      const group = dateGroupOf(n.created_at);
      if (!map[group]) {
        map[group] = [];
        order.push(group);
      }
      map[group].push(n);
    }
    return order.map((label) => ({ label, items: map[label] }));
  }, [notifications, activeFilter]);

  if (!isAuthenticated) {
    return (
      <main className="pt-24 pb-16 bg-[#faf8f3] min-h-screen">
        <div className="container-custom max-w-2xl text-center">
          <p className="text-slate-600">
            Please <Link to="/login" className="text-emerald-700 font-semibold underline">log in</Link> to see your notifications.
          </p>
        </div>
      </main>
    );
  }

  const hasAny = notifications.length > 0;
  const isEmptyView = !loading && groupedNotifications.length === 0;

  return (
    <>
      <NoIndexSEO title="Notifications - Naturanza Food" />
      <main className="pt-20 sm:pt-24 pb-14 sm:pb-16 bg-[#faf8f3] min-h-screen">
        <div className="container-custom max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2d3a2d]">
                  Notifications
                </h1>
                <p className="text-xs text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                >
                  {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              {hasAny && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">Clear all</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          {hasAny && (
            <div className="flex flex-wrap gap-2 mb-5">
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.key;
                const count = counts[filter.key];
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-emerald-600 text-white"
                        : "bg-white border border-emerald-100 text-slate-600 hover:bg-emerald-50"
                    }`}
                  >
                    {filter.label}
                    {count > 0 && (
                      <span
                        className={`inline-flex min-w-[18px] justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          isActive ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          ) : isEmptyView ? (
            <div className="rounded-2xl border border-emerald-100 bg-white p-10 text-center text-slate-500">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">
                {activeFilter === "all"
                  ? "No notifications yet"
                  : `No ${activeFilter === "unread" ? "unread" : activeFilter} notifications`}
              </p>
              <p className="text-sm mt-1">
                {activeFilter === "all"
                  ? "You'll see order and payment updates here."
                  : "Try a different filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedNotifications.map((group) => (
                <div key={group.label}>
                  <p className="px-1 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                  <ul className="space-y-2.5">
                    {group.items.map((notif) => {
                      const Icon = iconForType(notif.type);
                      const accent = accentForType(notif.type);
                      const isUnread = !notif.is_read;
                      const clickable = isUnread || Boolean(linkForNotification(notif));
                      return (
                        <li key={notif.id}>
                          <div
                            role={clickable ? "button" : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onClick={clickable ? () => handleItemClick(notif) : undefined}
                            onKeyDown={
                              clickable
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleItemClick(notif);
                                    }
                                  }
                                : undefined
                            }
                            className={`group relative flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
                              isUnread
                                ? "border-emerald-200 bg-white"
                                : "border-emerald-50 bg-emerald-50/40"
                            } ${clickable ? "cursor-pointer hover:border-emerald-300 hover:shadow-md" : ""}`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 pr-7">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm ${isUnread ? "font-bold" : "font-semibold"} text-slate-900`}>
                                  {notif.title}
                                </p>
                                {isUnread && (
                                  <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                {notif.message}
                              </p>
                              <p className="text-xs text-slate-400 mt-2" title={formatDateTime(notif.created_at)}>
                                {formatRelativeTime(notif.created_at)}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label="Delete notification"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(notif.id);
                              }}
                              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default Notifications;
