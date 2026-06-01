import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  Clock3,
  ExternalLink,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";

const MOBILE_INITIAL_NOTIFICATIONS = 8;

const typeClassMap = {
  admin_order_created: "bg-blue-100 text-blue-700",
  admin_low_stock: "bg-amber-100 text-amber-700",
  admin_contact_created: "bg-violet-100 text-violet-700",
  return_review_required: "bg-amber-100 text-amber-700",
  default: "bg-gray-100 text-gray-700",
};

// Broad category for the filter tabs.
const categoryOf = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("order")) return "order";
  if (t.includes("stock") || t.includes("inventory")) return "stock";
  if (t.includes("contact") || t.includes("message")) return "message";
  if (t.includes("payment")) return "payment";
  return "other";
};

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "stock", label: "Stock" },
  { key: "message", label: "Messages" },
];

const safePayload = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

// Where a notification links to, for the detail-pane "open" button.
const linkForNotification = (notification) => {
  const p = safePayload(notification?.payload);
  if (p.order_id) return { to: "/admin/orders", label: "View order" };
  if (p.contact_id || p.message_id) return { to: "/admin/messages", label: "Open message" };
  if (p.product_id) return { to: "/admin/products", label: "View product" };
  return null;
};

// "Just now" / "5m ago" / "2h ago" / "3d ago", then an absolute date.
const formatRelativeTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatMutedUntil = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function AdminNotifications() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    isMuted,
    mutedUntil,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    updateMuteSettings,
  } = useAdminNotifications();

  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isSavingMute, setIsSavingMute] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((item) => !item.is_read);
    }
    if (activeFilter === "all") {
      return notifications;
    }
    return notifications.filter((item) => categoryOf(item.type) === activeFilter);
  }, [activeFilter, notifications]);

  const filterCounts = useMemo(
    () => ({
      all: notifications.length,
      unread: unreadCount,
      order: notifications.filter((n) => categoryOf(n.type) === "order").length,
      stock: notifications.filter((n) => categoryOf(n.type) === "stock").length,
      message: notifications.filter((n) => categoryOf(n.type) === "message").length,
    }),
    [notifications, unreadCount],
  );

  const mobileRows = useMemo(
    () =>
      showAllMobileRows
        ? filteredNotifications
        : filteredNotifications.slice(0, MOBILE_INITIAL_NOTIFICATIONS),
    [filteredNotifications, showAllMobileRows],
  );

  const selectedNotification = useMemo(() => {
    if (!filteredNotifications.length) {
      return null;
    }

    return (
      filteredNotifications.find((item) => item.id === selectedNotificationId) ||
      filteredNotifications[0]
    );
  }, [filteredNotifications, selectedNotificationId]);

  const quickSummaryItems = useMemo(
    () => [
      { key: "total", label: "Total", value: notifications.length },
      { key: "unread", label: "Unread", value: unreadCount },
      { key: "read", label: "Read", value: Math.max(notifications.length - unreadCount, 0) },
      { key: "mute", label: "Mute", value: isMuted ? "On" : "Off" },
    ],
    [isMuted, notifications.length, unreadCount],
  );

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [activeFilter]);

  useEffect(() => {
    if (!filteredNotifications.length) {
      setSelectedNotificationId(null);
      return;
    }

    const hasCurrentSelection = filteredNotifications.some(
      (item) => item.id === selectedNotificationId,
    );

    if (!hasCurrentSelection) {
      setSelectedNotificationId(filteredNotifications[0].id);
    }
  }, [filteredNotifications, selectedNotificationId]);

  const handleSelectNotification = async (notification) => {
    setSelectedNotificationId(notification.id);
    setActionError("");

    if (notification.is_read) {
      return;
    }

    try {
      await markNotificationRead(notification.id);
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to mark notification as read",
      );
    }
  };

  const handleMarkAllRead = async () => {
    setActionError("");
    try {
      await markAllNotificationsRead();
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to mark all notifications as read",
      );
    }
  };

  const handleDeleteOne = async (notificationId) => {
    setActionError("");
    try {
      await deleteNotification(notificationId);
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error || requestError?.message || "Failed to delete notification",
      );
    }
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    setActionError("");
    try {
      await clearAllNotifications();
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error || requestError?.message || "Failed to clear notifications",
      );
    }
  };

  const handleOpenLink = (notification) => {
    const link = linkForNotification(notification);
    if (link) navigate(link.to);
  };

  const handleToggleMute = async () => {
    setActionError("");
    try {
      setIsSavingMute(true);
      await updateMuteSettings({ isMuted: !isMuted });
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to update mute settings",
      );
    } finally {
      setIsSavingMute(false);
    }
  };

  const handleMuteForOneHour = async () => {
    setActionError("");
    try {
      setIsSavingMute(true);
      await updateMuteSettings({ isMuted: true, mutedForMinutes: 60 });
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to set mute duration",
      );
    } finally {
      setIsSavingMute(false);
    }
  };

  const mutedUntilLabel = formatMutedUntil(mutedUntil);

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Notifications</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Real-time alerts from orders, customer messages, and store operations.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void refreshNotifications()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void handleToggleMute()}
              disabled={isSavingMute}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              {isMuted ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              {isMuted ? "Unmute" : "Mute"}
            </button>

            <button
              type="button"
              onClick={() => void handleMuteForOneHour()}
              disabled={isSavingMute}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <Clock3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Mute 1h
            </button>

            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={!notifications.length}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 text-[13px] font-semibold text-red-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Clear all
            </button>
          </div>
        </div>

        {isMuted ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 sm:text-sm">
            <BellOff className="h-4 w-4" />
            Notifications are muted
            {mutedUntilLabel ? ` until ${mutedUntilLabel}` : ""}.
          </div>
        ) : null}

        {error || actionError ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {actionError || error}
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

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-bold text-slate-900">Inbox</p>
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-200 px-2.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isActive
                        ? "bg-emerald-700 text-white"
                        : "border border-emerald-100 bg-[#f4faf5] text-slate-600"
                    }`}
                  >
                    {filter.label} ({filterCounts[filter.key] ?? 0})
                  </button>
                );
              })}
            </div>

            <div className="space-y-2.5">
              {mobileRows.length > 0 ? (
                mobileRows.map((item) => {
                  const statusClass = typeClassMap[item.type] || typeClassMap.default;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectNotification(item)}
                      className="w-full rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-2.5 text-left"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                          {item.is_read ? "read" : "new"}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-600">{item.message}</p>
                      <p className="mt-1 text-[11px] text-slate-500" title={formatDateTime(item.created_at)}>
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-900">No notifications</p>
                  <p className="mt-1 text-xs text-slate-500">New activity will appear here automatically.</p>
                </div>
              )}

              {filteredNotifications.length > MOBILE_INITIAL_NOTIFICATIONS ? (
                <button
                  type="button"
                  onClick={() => setShowAllMobileRows((prev) => !prev)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  {showAllMobileRows
                    ? "Show fewer notifications"
                    : `Show all ${filteredNotifications.length} notifications`}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="hidden grid-cols-[40%_60%] gap-4 md:grid xl:grid-cols-[36%_64%]">
          <div className="rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_30px_rgba(15,64,28,0.08)]">
            <div className="border-b border-emerald-100 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-lg font-bold text-slate-900">Notification Inbox</p>
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map((filter) => {
                  const isActive = activeFilter === filter.key;
                  const count = filterCounts[filter.key] ?? 0;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setActiveFilter(filter.key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                          : "border border-emerald-100 bg-emerald-50/65 text-slate-600 hover:bg-emerald-50"
                      }`}
                    >
                      {filter.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto divide-y divide-emerald-100">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((item) => {
                  const isActive = selectedNotification?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectNotification(item)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        isActive ? "bg-emerald-50" : "hover:bg-emerald-50/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        {!item.is_read ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-600">{item.message}</p>
                      <p className="mt-1 text-xs text-slate-400" title={formatDateTime(item.created_at)}>
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="p-4 text-sm text-slate-500">No notifications found.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
            {selectedNotification ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-slate-900">{selectedNotification.title}</p>
                    <p className="mt-1 text-sm text-slate-500" title={formatDateTime(selectedNotification.created_at)}>
                      {formatRelativeTime(selectedNotification.created_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedNotification.is_read ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {selectedNotification.is_read ? "Read" : "Unread"}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    <Bell className="h-3.5 w-3.5" />
                    Type: {selectedNotification.type || "general"}
                  </span>

                  {linkForNotification(selectedNotification) ? (
                    <button
                      type="button"
                      onClick={() => handleOpenLink(selectedNotification)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {linkForNotification(selectedNotification).label}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleDeleteOne(selectedNotification.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-slate-900">No notification selected</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Select any notification from inbox to view details.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
