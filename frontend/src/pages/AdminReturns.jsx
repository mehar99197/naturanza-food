import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminAPI } from "@/services/api";
import { AlertCircle, RefreshCw } from "lucide-react";

const STATUS_OPTIONS = ["requested", "approved", "rejected", "received", "refunded"];
const MOBILE_INITIAL_RETURNS = 5;

const statusBadgeClass = {
  requested: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  received: "bg-emerald-100 text-emerald-700",
  refunded: "bg-violet-100 text-violet-700",
};

export function AdminReturns() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [returns, setReturns] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [selectedReturnId, setSelectedReturnId] = useState(null);
  const [mobileView, setMobileView] = useState("queue");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);

  const loadReturns = async () => {
    try {
      setLoading(true);
      setError("");
      const params = statusFilter === "all" ? {} : { status: statusFilter };
      const response = await adminAPI.getReturns(params);
      const list = Array.isArray(response) ? response : [];
      setReturns(list);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReturns();
  }, [statusFilter]);

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [statusFilter]);

  const updateDraft = (returnId, changes) => {
    setDrafts((prev) => ({
      ...prev,
      [returnId]: {
        status: prev[returnId]?.status || "approved",
        note: prev[returnId]?.note || "",
        refund_amount: prev[returnId]?.refund_amount || "",
        method: prev[returnId]?.method || "manual",
        reference_number: prev[returnId]?.reference_number || "",
        ...changes,
      },
    }));
  };

  const submitStatusUpdate = async (requestRecord) => {
    const draft = drafts[requestRecord.id] || {
      status: requestRecord.status,
      note: "",
      refund_amount: requestRecord.requested_amount || "",
      method: "manual",
      reference_number: "",
    };

    try {
      await adminAPI.updateReturnStatus(requestRecord.id, {
        status: draft.status,
        note: draft.note,
        refund_amount: draft.status === "refunded" ? Number(draft.refund_amount || 0) : undefined,
        method: draft.status === "refunded" ? draft.method : undefined,
        reference_number: draft.status === "refunded" ? draft.reference_number : undefined,
      });

      await loadReturns();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update return status");
    }
  };

  const statusCounts = useMemo(() => {
    return returns.reduce(
      (counts, item) => {
        const status = String(item.status || "requested").toLowerCase();
        if (Object.prototype.hasOwnProperty.call(counts, status)) {
          counts[status] += 1;
        }
        return counts;
      },
      { requested: 0, approved: 0, rejected: 0, received: 0, refunded: 0 },
    );
  }, [returns]);

  const selectedReturn = returns.find((item) => item.id === selectedReturnId) || null;
  const selectedDraft = selectedReturn
    ? drafts[selectedReturn.id] || {
        status: selectedReturn.status,
        note: "",
        refund_amount: selectedReturn.requested_amount || "",
        method: "manual",
        reference_number: "",
      }
    : null;

  const mobileRows = useMemo(
    () => (showAllMobileRows ? returns : returns.slice(0, MOBILE_INITIAL_RETURNS)),
    [returns, showAllMobileRows],
  );

  const quickSummaryItems = useMemo(
    () => [
      { key: "total", label: "Total", value: returns.length },
      { key: "requested", label: "Requested", value: statusCounts.requested },
      { key: "approved", label: "Approved", value: statusCounts.approved },
      { key: "refunded", label: "Refunded", value: statusCounts.refunded },
    ],
    [returns.length, statusCounts.approved, statusCounts.refunded, statusCounts.requested],
  );

  const openReturnRecord = (requestRecord) => {
    setSelectedReturnId(requestRecord.id);
    setMobileView("detail");
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Returns Management</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Approve, reject, receive and refund return requests in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReturns()}
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
                  <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)]">
          <label className="mr-2 text-sm font-semibold text-slate-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-emerald-100 px-3 py-2 text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <section className="md:hidden">
          <div className="inline-flex rounded-full border border-emerald-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileView("queue")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "queue" ? "bg-emerald-700 text-white" : "text-slate-600"
              }`}
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => setMobileView("detail")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "detail" ? "bg-emerald-700 text-white" : "text-slate-600"
              }`}
            >
              Detail
            </button>
          </div>
        </section>

        <section className={`${mobileView === "detail" ? "hidden md:block" : "block"}`}>
          <div className="rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_30px_rgba(15,64,28,0.08)]">
            <div className="max-h-[64vh] divide-y divide-emerald-100 overflow-y-auto md:hidden">
              {mobileRows.length > 0 ? (
                <>
                  {mobileRows.map((requestRecord) => {
                    const status = String(requestRecord.status || "requested").toLowerCase();
                    const isActive = selectedReturnId === requestRecord.id;

                    return (
                      <button
                        key={requestRecord.id}
                        type="button"
                        onClick={() => openReturnRecord(requestRecord)}
                        className={`w-full px-3 py-3 text-left ${
                          isActive ? "bg-emerald-50" : "bg-white"
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">Request #{requestRecord.id}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass[status] || "bg-gray-100 text-gray-700"}`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="truncate text-xs font-semibold text-slate-700">
                          {requestRecord.user_name || "Customer"} · #{requestRecord.order_id}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {requestRecord.reason || "No reason"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Amount: {Number(requestRecord.requested_amount || 0).toFixed(2)}
                        </p>
                      </button>
                    );
                  })}

                  {returns.length > MOBILE_INITIAL_RETURNS ? (
                    <div className="p-3">
                      <button
                        type="button"
                        onClick={() => setShowAllMobileRows((prev) => !prev)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                      >
                        {showAllMobileRows
                          ? "Show fewer requests"
                          : `Show all ${returns.length} requests`}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="p-4 text-sm text-slate-500">No return requests found.</p>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1020px] text-sm">
                <thead>
                  <tr className="border-b border-emerald-100 bg-[#f8faf7] text-left text-slate-600">
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Current</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((requestRecord) => {
                    const draft = drafts[requestRecord.id] || {
                      status: requestRecord.status,
                      note: "",
                      refund_amount: requestRecord.requested_amount || "",
                      method: "manual",
                      reference_number: "",
                    };

                    return (
                      <tr key={requestRecord.id} className="border-b align-top">
                        <td className="px-4 py-3 font-semibold">#{requestRecord.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{requestRecord.user_name}</div>
                          <div className="text-slate-500">{requestRecord.user_email}</div>
                        </td>
                        <td className="px-4 py-3">#{requestRecord.order_id}</td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="font-medium">{requestRecord.reason}</div>
                          <div className="line-clamp-2 text-slate-500">{requestRecord.details || "-"}</div>
                        </td>
                        <td className="px-4 py-3">{Number(requestRecord.requested_amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 capitalize">{requestRecord.status}</td>
                        <td className="space-y-2 px-4 py-3">
                          <select
                            value={draft.status}
                            onChange={(e) => updateDraft(requestRecord.id, { status: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draft.note}
                            onChange={(e) => updateDraft(requestRecord.id, { note: e.target.value })}
                            placeholder="Admin note"
                            className="w-full rounded border border-gray-300 px-2 py-1"
                          />

                          {draft.status === "refunded" ? (
                            <>
                              <input
                                type="number"
                                value={draft.refund_amount}
                                onChange={(e) => updateDraft(requestRecord.id, { refund_amount: e.target.value })}
                                placeholder="Refund amount"
                                className="w-full rounded border border-gray-300 px-2 py-1"
                              />
                              <input
                                value={draft.method}
                                onChange={(e) => updateDraft(requestRecord.id, { method: e.target.value })}
                                placeholder="Refund method"
                                className="w-full rounded border border-gray-300 px-2 py-1"
                              />
                              <input
                                value={draft.reference_number}
                                onChange={(e) => updateDraft(requestRecord.id, { reference_number: e.target.value })}
                                placeholder="Reference number"
                                className="w-full rounded border border-gray-300 px-2 py-1"
                              />
                            </>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => submitStatusUpdate(requestRecord)}
                            className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white"
                          >
                            Apply
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={`${mobileView === "queue" ? "hidden md:block" : "block"} md:hidden`}>
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)]">
            {selectedReturn && selectedDraft ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                >
                  Back to queue
                </button>

                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3">
                  <p className="text-sm font-bold text-slate-900">Request #{selectedReturn.id}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedReturn.user_name || "Customer"} ({selectedReturn.user_email || "no-email"})
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Order #{selectedReturn.order_id} · Amount {Number(selectedReturn.requested_amount || 0).toFixed(2)}
                  </p>
                </div>

                <select
                  value={selectedDraft.status}
                  onChange={(e) => updateDraft(selectedReturn.id, { status: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <input
                  value={selectedDraft.note}
                  onChange={(e) => updateDraft(selectedReturn.id, { note: e.target.value })}
                  placeholder="Admin note"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                />

                {selectedDraft.status === "refunded" ? (
                  <>
                    <input
                      type="number"
                      value={selectedDraft.refund_amount}
                      onChange={(e) => updateDraft(selectedReturn.id, { refund_amount: e.target.value })}
                      placeholder="Refund amount"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={selectedDraft.method}
                      onChange={(e) => updateDraft(selectedReturn.id, { method: e.target.value })}
                      placeholder="Refund method"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                    />
                    <input
                      value={selectedDraft.reference_number}
                      onChange={(e) => updateDraft(selectedReturn.id, { reference_number: e.target.value })}
                      placeholder="Reference number"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => void submitStatusUpdate(selectedReturn)}
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d]"
                >
                  Apply Status Update
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-5 text-center">
                <p className="text-sm font-semibold text-slate-900">Select a return request</p>
                <p className="mt-1 text-xs text-slate-500">
                  Open any request from queue to update status.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
