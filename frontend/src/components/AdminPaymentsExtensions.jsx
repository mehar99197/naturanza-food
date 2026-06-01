import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Eye, Landmark, Smartphone, Wallet, X } from "lucide-react";
import { adminAPI } from "@/services/api";
import { buildRejectionWhatsAppLink, buildApprovalWhatsAppLink } from "@/utils/whatsappRejection";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

const accountMeta = [
  { type: "jazzcash", label: "JazzCash", icon: Wallet },
  { type: "easypaisa", label: "EasyPaisa", icon: Smartphone },
  { type: "bank", label: "Bank Transfer", icon: Landmark },
];

const verificationStatusStyles = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const stageBadgeStyles = {
  full_payment: { label: "Prepaid", className: "bg-emerald-100 text-emerald-800" },
  advance_shipping: { label: "COD-Advance", className: "bg-indigo-100 text-indigo-800" },
  final_collection: { label: "COD-Final", className: "bg-amber-100 text-amber-800" },
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const formatDateTimeCompact = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export function AdminPaymentsExtensions() {
  const { isSuperAdmin } = useAdminAuth();
  const { settings } = useSettings();

  const [accounts, setAccounts] = useState([]);
  const [initialAccounts, setInitialAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [savingAccountIds, setSavingAccountIds] = useState(new Set());

  const [verifications, setVerifications] = useState([]);
  const [verificationsLoading, setVerificationsLoading] = useState(true);
  const [verificationFilter, setVerificationFilter] = useState("pending");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [activeScreenshot, setActiveScreenshot] = useState(null);
  const [stage2NoteById, setStage2NoteById] = useState({});

  const initialAccountMap = useMemo(
    () => new Map(initialAccounts.map((account) => [account.id, account])),
    [initialAccounts],
  );

  const accountsByType = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      map.set(String(account.type || "").toLowerCase(), account);
    });
    return map;
  }, [accounts]);

  const orderedAccounts = useMemo(
    () =>
      accountMeta
        .map((meta) => ({
          ...meta,
          account: accountsByType.get(meta.type) || null,
        }))
        .filter((item) => item.account),
    [accountsByType],
  );

  const filteredVerifications = useMemo(() => {
    if (verificationFilter === "all") {
      return verifications;
    }

    if (verificationFilter === "cod_final_pending") {
      return verifications.filter(
        (v) =>
          String(v.verification_stage || "").toLowerCase() === "final_collection" &&
          String(v.status || "").toLowerCase() === "pending",
      );
    }

    // The generic "Pending" tab must NOT include final_collection rows —
    // those have their own dedicated "COD Final Pending" tab so admin
    // doesn't see the same order twice in two different workflows.
    if (verificationFilter === "pending") {
      return verifications.filter(
        (verification) =>
          String(verification.status || "pending").toLowerCase() === "pending" &&
          String(verification.verification_stage || "").toLowerCase() !== "final_collection",
      );
    }

    return verifications.filter(
      (verification) =>
        String(verification.status || "pending").toLowerCase() ===
        verificationFilter,
    );
  }, [verificationFilter, verifications]);

  const pendingCount = useMemo(
    () =>
      verifications.filter(
        (verification) =>
          String(verification.status || "pending").toLowerCase() === "pending" &&
          String(verification.verification_stage || "").toLowerCase() !== "final_collection",
      ).length,
    [verifications],
  );

  const codFinalPendingCount = useMemo(
    () =>
      verifications.filter(
        (v) =>
          String(v.verification_stage || "").toLowerCase() === "final_collection" &&
          String(v.status || "").toLowerCase() === "pending",
      ).length,
    [verifications],
  );

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await adminAPI.getPaymentAccounts();
      const nextAccounts = Array.isArray(response) ? response : [];
      setAccounts(nextAccounts);
      setInitialAccounts(nextAccounts);
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to load payment accounts",
      );
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadVerifications = async () => {
    try {
      setVerificationsLoading(true);
      const response = await adminAPI.getPaymentVerifications("all");
      setVerifications(Array.isArray(response) ? response : []);
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to load payment verifications",
      );
    } finally {
      setVerificationsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
    void loadVerifications();
  }, []);

  const handleAccountChange = (accountId, field, value) => {
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, [field]: value } : account,
      ),
    );
  };

  const isAccountDirty = (account) => {
    const original = initialAccountMap.get(account.id);
    if (!original) return false;
    return (
      String(original.account_number || "") !==
        String(account.account_number || "") ||
      String(original.account_name || "") !== String(account.account_name || "") ||
      Boolean(original.is_active) !== Boolean(account.is_active)
    );
  };

  const handleSaveAccount = async (account) => {
    if (!account || savingAccountIds.has(account.id)) {
      return;
    }

    setSavingAccountIds((prev) => {
      const next = new Set(prev);
      next.add(account.id);
      return next;
    });

    try {
      const payload = {
        account_number: account.account_number,
        account_name: account.account_name,
        is_active: Boolean(account.is_active),
      };
      const updated = await adminAPI.updatePaymentAccount(account.id, payload);
      setAccounts((prev) =>
        prev.map((item) => (item.id === account.id ? updated : item)),
      );
      setInitialAccounts((prev) =>
        prev.map((item) => (item.id === account.id ? updated : item)),
      );
      toast.success("Payment account updated successfully");
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to update payment account",
      );
    } finally {
      setSavingAccountIds((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  const handleApprove = async (verificationId, adminNote = null) => {
    if (actionLoadingId) return;
    setActionLoadingId(verificationId);
    try {
      const response = await adminAPI.approvePaymentVerification(
        verificationId,
        adminNote,
      );
      const updated = response?.verification || null;
      if (updated) {
        setVerifications((prev) =>
          prev.map((item) => (item.id === verificationId ? updated : item)),
        );
      } else {
        await loadVerifications();
      }
      setStage2NoteById((prev) => {
        if (!(verificationId in prev)) return prev;
        const next = { ...prev };
        delete next[verificationId];
        return next;
      });
      toast.success(
        adminNote ? "Cash collection confirmed" : "Payment marked as approved",
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to approve payment",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (verificationId) => {
    if (actionLoadingId) return;
    setActionLoadingId(verificationId);
    try {
      const response = await adminAPI.rejectPaymentVerification(
        verificationId,
        rejectReason,
      );
      const updated = response?.verification || null;
      if (updated) {
        setVerifications((prev) =>
          prev.map((item) => (item.id === verificationId ? updated : item)),
        );
      } else {
        await loadVerifications();
      }
      setRejectingId(null);
      setRejectReason("");
      toast.success("Payment marked as rejected");
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to reject payment",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Payment Account Numbers
            </h2>
            <p className="text-sm text-slate-600">
              Update account details used for advance payments.
            </p>
          </div>
          {!isSuperAdmin && (
            <span className="rounded-full border border-emerald-100 bg-[#f4faf5] px-3 py-1 text-xs font-semibold text-emerald-700">
              Read only
            </span>
          )}
        </div>

        {accountsLoading ? (
          <p className="text-sm text-slate-500">Loading payment accounts...</p>
        ) : (
          <div className="space-y-3">
            {orderedAccounts.map((row) => {
              const Icon = row.icon;
              const account = row.account;
              const dirty = isAccountDirty(account);
              const isSaving = savingAccountIds.has(account.id);

              return (
                <div
                  key={account.id}
                  className="rounded-2xl border border-emerald-100 bg-[#f7fbf7] p-3"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_auto_auto] md:items-center">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{row.label}</span>
                    </div>

                    <input
                      type="text"
                      value={account.account_number || ""}
                      onChange={(event) =>
                        handleAccountChange(
                          account.id,
                          "account_number",
                          event.target.value,
                        )
                      }
                      disabled={!isSuperAdmin}
                      readOnly={!isSuperAdmin}
                      className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-50"
                    />

                    <input
                      type="text"
                      value={account.account_name || ""}
                      onChange={(event) =>
                        handleAccountChange(
                          account.id,
                          "account_name",
                          event.target.value,
                        )
                      }
                      disabled={!isSuperAdmin}
                      readOnly={!isSuperAdmin}
                      className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-50"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        isSuperAdmin &&
                        handleAccountChange(
                          account.id,
                          "is_active",
                          !account.is_active,
                        )
                      }
                      disabled={!isSuperAdmin}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        account.is_active ? "bg-emerald-500" : "bg-gray-200"
                      } ${!isSuperAdmin ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          account.is_active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveAccount(account)}
                      disabled={!isSuperAdmin || !dirty || isSaving}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition-all duration-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Advance Payment Verification
            </h2>
            <p className="text-sm text-slate-600">
              Review and verify customer advance payment submissions.
            </p>
          </div>
          <div className="inline-flex flex-wrap rounded-full border border-emerald-100 bg-[#f4faf5] p-1">
            {[
              { key: "pending", label: "Pending", badge: pendingCount },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
              { key: "all", label: "All" },
              { key: "cod_final_pending", label: "COD Final Pending", badge: codFinalPendingCount },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setVerificationFilter(tab.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  verificationFilter === tab.key
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600"
                }`}
              >
                {tab.label}
                {Number.isFinite(tab.badge) && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      verificationFilter === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {verificationsLoading ? (
          <p className="text-sm text-slate-500">Loading verifications...</p>
        ) : filteredVerifications.length === 0 ? (
          <p className="text-sm text-slate-500">No verification requests found.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <div className="inline-block min-w-full align-middle px-4 sm:px-5">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-emerald-100">
                  <th className="pb-3 pr-4 whitespace-nowrap">Order</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Customer</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Amounts</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Payment</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Screenshot</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Date</th>
                  <th className="pb-3 pr-4 whitespace-nowrap">Status</th>
                  <th className="pb-3 whitespace-nowrap min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredVerifications.map((verification) => {
                  const status = String(verification.status || "pending").toLowerCase();
                  const stageKey = String(verification.verification_stage || "full_payment").toLowerCase();
                  const stageMeta = stageBadgeStyles[stageKey] || stageBadgeStyles.full_payment;
                  const isFinalCollection = stageKey === "final_collection";
                  const screenshotUrl = verification.screenshot_url
                    ? getAbsoluteImageUrl(verification.screenshot_url)
                    : "";
                  const isPending = status === "pending";
                  const isRejecting = rejectingId === verification.id;

                  const orderTotal = Number(verification.order_total || verification.amount || 0);
                  // For a COD final-collection row, `amount` is the cash still to be
                  // COLLECTED (the remaining COD) and the advance was already paid.
                  // For every other stage, `amount` is what the customer already PAID
                  // (the advance, or the full prepaid amount).
                  const verificationAmount = Number(verification.amount || 0);
                  const paidAmount = isFinalCollection
                    ? Math.max(0, orderTotal - verificationAmount)
                    : verificationAmount;
                  const pendingAmount = isFinalCollection
                    ? verificationAmount
                    : Math.max(0, orderTotal - paidAmount);
                  const paymentMethodDisplay = verification.payment_method
                    ? (verification.payment_method === "jazzcash" ? "JazzCash" : verification.payment_method === "easypaisa" ? "EasyPaisa" : verification.payment_method === "cod" ? "Cash" : verification.payment_method)
                    : "-";

                  return (
                    <tr key={verification.id} className="text-slate-700 align-top">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">
                          #{verification.order_id}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageMeta.className}`}
                          title={stageKey}
                        >
                          {stageMeta.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 min-w-[160px]">
                        <p className="font-medium text-slate-800">
                          {verification.customer_name}
                        </p>
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          {verification.customer_phone || "-"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-slate-500">
                            Total: <span className="font-semibold text-slate-900">{formatPrice(orderTotal, settings.currency)}</span>
                          </span>
                          <span className="text-slate-500">
                            Paid: <span className="font-semibold text-emerald-700">{formatPrice(paidAmount, settings.currency)}</span>
                          </span>
                          {pendingAmount > 0 ? (
                            <span className="text-slate-500">
                              Pending: <span className="font-semibold text-amber-700">{formatPrice(pendingAmount, settings.currency)}</span>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-800">
                          {paymentMethodDisplay}
                        </p>
                        {verification.transaction_id ? (
                          <span
                            className="mt-1 inline-block max-w-[140px] truncate rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700"
                            title={verification.transaction_id}
                          >
                            {verification.transaction_id}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No TID</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {screenshotUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveScreenshot({
                                url: screenshotUrl,
                                label: verification.order_id,
                              })
                            }
                            className="flex items-center gap-2"
                          >
                            <img
                              src={screenshotUrl}
                              alt={`Screenshot ${verification.order_id}`}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                              View
                            </span>
                            <Eye className="h-4 w-4 text-emerald-600" />
                          </button>
                        ) : isFinalCollection ? (
                          <span className="text-xs italic text-slate-400">Not required</span>
                        ) : (
                          <span className="text-xs text-slate-400">No file</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTimeCompact(verification.created_at)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            verificationStatusStyles[status] ||
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3 min-w-[200px]">
                        {isPending ? (
                          isRejecting ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(event) =>
                                  setRejectReason(event.target.value)
                                }
                                placeholder="Rejection reason"
                                className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReject(verification.id)
                                  }
                                  disabled={
                                    actionLoadingId === verification.id ||
                                    !rejectReason.trim()
                                  }
                                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-60"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectReason("");
                                  }}
                                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : isFinalCollection ? (
                            <div className="space-y-2">
                              <textarea
                                value={stage2NoteById[verification.id] || ""}
                                onChange={(event) =>
                                  setStage2NoteById((prev) => ({
                                    ...prev,
                                    [verification.id]: event.target.value,
                                  }))
                                }
                                placeholder="Optional note (e.g. cash received from rider)"
                                rows={2}
                                className="w-full min-w-[180px] rounded-lg border border-emerald-100 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApprove(
                                      verification.id,
                                      stage2NoteById[verification.id]?.trim() || null,
                                    )
                                  }
                                  disabled={actionLoadingId === verification.id}
                                  className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                                >
                                  Confirm Cash Received
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingId(verification.id);
                                    setRejectReason("");
                                  }}
                                  disabled={actionLoadingId === verification.id}
                                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-60"
                                >
                                  Collection Failed
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprove(verification.id)}
                                disabled={actionLoadingId === verification.id}
                                className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(verification.id);
                                  setRejectReason("");
                                }}
                                disabled={actionLoadingId === verification.id}
                                className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="text-xs text-slate-500 space-y-1 min-w-[180px]">
                            <p className="whitespace-nowrap">
                              <span className="text-slate-400">By:</span>{" "}
                              <span className="font-medium text-slate-700">{verification.verified_by_name || "-"}</span>
                            </p>
                            <p className="whitespace-nowrap">{formatDateTimeCompact(verification.verified_at)}</p>
                            {verification.admin_note && (
                              <p className="italic text-slate-600">
                                Note: {verification.admin_note}
                              </p>
                            )}
                            {verification.status === "approved" && (() => {
                              const href = buildApprovalWhatsAppLink({
                                customerName: verification.customer_name,
                                customerPhone: verification.customer_phone,
                                orderId: verification.order_id,
                                amount: verification.amount,
                                currency: settings.currency,
                                verificationStage: verification.verification_stage,
                              });
                              if (!href) return null;
                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Notify customer via WhatsApp"
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                    <path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.6A11 11 0 1 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.9 1 .9-2.8-.2-.3a9 9 0 1 1 7.1 3.6Zm5.1-6.7c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6 0-1.2-.5-2.4-1.5a8.7 8.7 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4s.1-.3 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.7 4.2c.7.3 1.2.5 1.6.6a4 4 0 0 0 1.8.1 3 3 0 0 0 2-1.4 2.4 2.4 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z"/>
                                  </svg>
                                  Notify on WhatsApp
                                </a>
                              );
                            })()}
                            {verification.status === "rejected" && !isFinalCollection && (() => {
                              const href = buildRejectionWhatsAppLink({
                                customerName: verification.customer_name,
                                customerPhone: verification.customer_phone,
                                orderId: verification.order_id,
                                rejectionReason: verification.rejection_reason,
                              });
                              if (!href) return null;
                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Notify customer via WhatsApp"
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                    <path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.6A11 11 0 1 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.9 1 .9-2.8-.2-.3a9 9 0 1 1 7.1 3.6Zm5.1-6.7c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6 0-1.2-.5-2.4-1.5a8.7 8.7 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4s.1-.3 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.7 4.2c.7.3 1.2.5 1.6.6a4 4 0 0 0 1.8.1 3 3 0 0 0 2-1.4 2.4 2.4 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z"/>
                                  </svg>
                                  Notify on WhatsApp
                                </a>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {activeScreenshot && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveScreenshot(null);
              }
            }}
          >
            <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Screenshot · {activeScreenshot.label}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveScreenshot(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[80vh] overflow-auto bg-slate-50 p-4">
                <img
                  src={activeScreenshot.url}
                  alt="Payment screenshot"
                  className="mx-auto max-h-[72vh] w-auto rounded-xl object-contain"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
