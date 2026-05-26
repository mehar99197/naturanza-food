import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { useSettings } from "@/context/SettingsContext";
import { newsletterAPI, adminAPI } from "@/services/api";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const statusBadge = (status) => {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-600";
};

export function AdminSubscribers() {
  const { updateSettings } = useSettings();

  const [subscribers, setSubscribers] = useState([]);
  const [counts, setCounts] = useState({ active: 0, unsubscribed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [promoOriginal, setPromoOriginal] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoCoupon, setPromoCoupon] = useState(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastError, setBroadcastError] = useState("");

  const loadSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const response = await newsletterAPI.listSubscribers(params);
      setSubscribers(Array.isArray(response?.subscribers) ? response.subscribers : []);
      setCounts(
        response?.counts || { active: 0, unsubscribed: 0, total: 0 },
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "Failed to load subscribers",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  // Load promo code from admin settings and resolve the linked coupon
  useEffect(() => {
    (async () => {
      try {
        const settings = await adminAPI.getSettings();
        const code = String(settings?.newsletterWelcomePromoCode || "");
        setPromoCode(code);
        setPromoOriginal(code);

        if (code) {
          try {
            const coupons = await adminAPI.getCoupons();
            const arr = Array.isArray(coupons) ? coupons : coupons?.coupons || [];
            const match = arr.find(
              (c) => String(c.code || "").toUpperCase() === code,
            );
            setPromoCoupon(match || null);
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const promoDiscountLabel = useMemo(() => {
    if (!promoCoupon) return null;
    const value = Number(promoCoupon.discount_value);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (promoCoupon.discount_type === "fixed") {
      return `Rs ${value.toLocaleString("en-PK")} off`;
    }
    const v = value % 1 === 0 ? value.toFixed(0) : value;
    return `${v}% off`;
  }, [promoCoupon]);

  const filteredSubscribers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return subscribers;
    return subscribers.filter((sub) =>
      String(sub.email || "").toLowerCase().includes(query),
    );
  }, [subscribers, searchQuery]);

  const handleDelete = async (subscriber) => {
    const confirmed = window.confirm(
      `Permanently delete ${subscriber.email}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await newsletterAPI.deleteSubscriber(subscriber.id);
      await loadSubscribers();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete subscriber");
    }
  };

  const handleSavePromo = async () => {
    const trimmed = promoCode.trim().toUpperCase().slice(0, 40);
    setPromoCode(trimmed);
    setPromoSaving(true);
    setPromoMessage("");
    setPromoError("");
    try {
      const result = await newsletterAPI.setWelcomePromo(trimmed);
      setPromoOriginal(trimmed);
      setPromoCoupon(result?.coupon || null);
      setPromoMessage(result?.message || "Saved");
      // Keep the settings context loosely in sync so other pages reading
      // newsletterWelcomePromoCode pick up the new value on next fetch.
      updateSettings({ newsletterWelcomePromoCode: trimmed });
    } catch (requestError) {
      setPromoError(
        requestError?.response?.data?.error || "Could not save promo code",
      );
    } finally {
      setPromoSaving(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setBroadcastError("");
    setBroadcastResult(null);
    if (counts.active === 0) {
      setBroadcastError("No active subscribers to send to");
      return;
    }
    setBroadcastSending(true);
    try {
      const result = await newsletterAPI.broadcast({
        subject: broadcastSubject.trim(),
        message: broadcastMessage.trim(),
      });
      setBroadcastResult(result);
    } catch (requestError) {
      setBroadcastError(
        requestError?.response?.data?.error ||
          "Failed to send broadcast. Please try again.",
      );
    } finally {
      setBroadcastSending(false);
    }
  };

  const closeBroadcast = () => {
    setBroadcastOpen(false);
    setBroadcastSubject("");
    setBroadcastMessage("");
    setBroadcastResult(null);
    setBroadcastError("");
  };

  const promoDirty = promoCode.trim().toUpperCase() !== promoOriginal;

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div>
            <h1 className="mb-1.5 text-[2rem] font-bold text-slate-900 sm:mb-2 sm:text-3xl">
              Newsletter Subscribers
            </h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Manage your subscriber list and send updates.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadSubscribers()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 sm:gap-2 sm:px-4 sm:text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setBroadcastOpen(true)}
              disabled={counts.active === 0}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed sm:gap-2 sm:text-sm"
            >
              <Send className="w-4 h-4" />
              Send Update
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Active</p>
                <p className="text-2xl font-bold text-slate-900">{counts.active}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Unsubscribed</p>
                <p className="text-2xl font-bold text-slate-900">{counts.unsubscribed}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome promo code */}
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Welcome Promo Code
              </h2>
              <p className="text-xs text-slate-500">
                Shown in the welcome email. We'll auto-create a matching coupon (10% off) if one doesn't exist. Leave blank to skip.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              maxLength={40}
              className="flex-1 rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 font-mono tracking-wider"
            />
            <button
              onClick={handleSavePromo}
              disabled={!promoDirty || promoSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>

          {promoCoupon && promoDiscountLabel && !promoDirty && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                <CheckCircle className="w-4 h-4" />
                Linked coupon — {promoDiscountLabel}
                {promoCoupon.is_active ? "" : " (inactive)"}
              </span>
              <a
                href="/admin/coupons"
                className="text-emerald-700 underline-offset-2 hover:underline font-semibold"
              >
                Edit coupon details →
              </a>
            </div>
          )}

          {promoMessage && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {promoMessage}
            </div>
          )}
          {promoError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {promoError}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-emerald-100 bg-white outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 text-sm"
            />
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "unsubscribed", label: "Unsubscribed" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter === item.key
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* List */}
        <div className="rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              {searchQuery
                ? "No subscribers match your search."
                : "No subscribers yet. They'll appear here when people subscribe from the homepage."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Source</th>
                    <th className="px-4 py-3 text-left font-semibold">Subscribed</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-t border-emerald-50 hover:bg-emerald-50/40"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 break-all">
                        {sub.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(sub.status)}`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{sub.source || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(sub.subscribed_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(sub)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-semibold"
                          title="Delete subscriber"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Broadcast modal */}
        {broadcastOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Send className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">Send Update to Subscribers</h2>
                    <p className="text-xs text-slate-500">
                      Will be sent to {counts.active} active subscriber{counts.active === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>
                <button onClick={closeBroadcast} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {broadcastResult ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7 text-emerald-700" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">Broadcast sent</h3>
                  <p className="text-sm text-slate-600">
                    {broadcastResult.sent} delivered, {broadcastResult.failed} failed of{" "}
                    {broadcastResult.total} active subscribers.
                  </p>
                  <button
                    onClick={closeBroadcast}
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBroadcast} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                    <input
                      type="text"
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                      placeholder="New product launch — 20% off!"
                      maxLength={200}
                      required
                      className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Hi everyone! We just launched our new organic honey collection. Use code HONEY15 for 15% off until Friday..."
                      rows={8}
                      maxLength={10000}
                      required
                      className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 resize-y"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Plain text. Empty lines start a new paragraph. Unsubscribe link is added automatically.
                    </p>
                  </div>
                  {broadcastError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {broadcastError}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={closeBroadcast}
                      disabled={broadcastSending}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        broadcastSending ||
                        !broadcastSubject.trim() ||
                        broadcastMessage.trim().length < 10
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {broadcastSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {broadcastSending ? "Sending..." : "Send to All"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminSubscribers;
