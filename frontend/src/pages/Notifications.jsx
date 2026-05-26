import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Loader2,
  Package,
  ShoppingBag,
  Tag,
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
  if (payload.order_id) {
    return `/orders`;
  }
  return null;
};

export function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

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
    try {
      await userAPI.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        ),
      );
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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

  return (
    <>
      <NoIndexSEO title="Notifications - Naturanza Food" />
      <main className="pt-20 sm:pt-24 pb-14 sm:pb-16 bg-[#faf8f3] min-h-screen">
        <div className="container-custom max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2d3a2d]">
                  Notifications
                </h1>
                <p className="text-xs text-slate-500">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
              >
                {markingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-white p-10 text-center text-slate-500">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No notifications yet</p>
              <p className="text-sm mt-1">
                You'll see order and payment updates here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((notif) => {
                const Icon = iconForType(notif.type);
                const accent = accentForType(notif.type);
                const link = linkForNotification(notif);
                const isUnread = !notif.is_read;
                const inner = (
                  <div
                    className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
                      isUnread
                        ? "border-emerald-200 bg-white"
                        : "border-emerald-50 bg-emerald-50/40"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
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
                      <p className="text-xs text-slate-400 mt-2">
                        {formatDateTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={notif.id} onClick={isUnread ? () => handleMarkOne(notif.id) : undefined}>
                    {link ? (
                      <Link to={link}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

export default Notifications;
