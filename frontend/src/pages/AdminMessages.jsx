import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { contactAPI } from "@/services/api";

const statusClasses = {
  new: "bg-emerald-100 text-emerald-700",
  read: "bg-blue-100 text-blue-700",
  responded: "bg-violet-100 text-violet-700",
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function AdminMessages() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileView, setMobileView] = useState("queue");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = statusFilter === "all" ? {} : { status: statusFilter };
      const response = await contactAPI.getAll(params);
      const rows = Array.isArray(response) ? response : [];
      setMessages(rows);

      if (selectedMessageId) {
        const refreshedSelection = rows.find((item) => item.id === selectedMessageId);
        setSelectedMessage(refreshedSelection || null);
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load messages",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedMessageId, statusFilter]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    return messages.filter((item) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }

      return (
        String(item.name || "").toLowerCase().includes(query) ||
        String(item.email || "").toLowerCase().includes(query) ||
        String(item.subject || "").toLowerCase().includes(query) ||
        String(item.message || "").toLowerCase().includes(query)
      );
    });
  }, [messages, searchQuery]);

  const openMessage = async (messageItem) => {
    try {
      setSelectedMessageId(messageItem.id);
      setMobileView("detail");
      const response = await contactAPI.getById(messageItem.id);
      setSelectedMessage(response || messageItem);
      await loadMessages();
    } catch (requestError) {
      setSelectedMessageId(messageItem.id);
      setMobileView("detail");
      setSelectedMessage(messageItem);
      setError(requestError?.response?.data?.error || "Failed to open message");
    }
  };

  const updateStatus = async (nextStatus) => {
    if (!selectedMessage) {
      return;
    }

    try {
      await contactAPI.updateStatus(selectedMessage.id, nextStatus);
      await loadMessages();
      setSelectedMessage((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update status");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) {
      return;
    }

    try {
      await contactAPI.delete(messageId);
      if (selectedMessageId === messageId) {
        setSelectedMessageId(null);
        setSelectedMessage(null);
        setMobileView("queue");
      }
      await loadMessages();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete message");
    }
  };

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    return messages.reduce(
      (counts, item) => {
        const status = String(item.status || "new").toLowerCase();
        if (status === "new" || status === "read" || status === "responded") {
          counts[status] += 1;
        }
        return counts;
      },
      { new: 0, read: 0, responded: 0 },
    );
  }, [messages]);

  const quickSummaryItems = useMemo(
    () => [
      { key: "all", label: "Inbox", value: filteredMessages.length },
      { key: "new", label: "New", value: statusCounts.new },
      { key: "read", label: "Read", value: statusCounts.read },
      { key: "responded", label: "Resp", value: statusCounts.responded },
    ],
    [filteredMessages.length, statusCounts.new, statusCounts.read, statusCounts.responded],
  );

  const mobileRows = useMemo(
    () => (showAllMobileRows ? filteredMessages : filteredMessages.slice(0, 5)),
    [filteredMessages, showAllMobileRows],
  );

  const unreadCount = statusCounts.new;

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={0} rows={8} showSidebar />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Messages</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Customer inquiries synced from your real contact database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadMessages()}
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

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-bold text-slate-900">Inbox</p>
              <p className="text-xs text-slate-500">
                {filteredMessages.length} messages · {unreadCount} unread
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search messages..."
                  className="w-full rounded-xl border border-emerald-100 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "new", label: "New" },
                  { value: "read", label: "Read" },
                  { value: "responded", label: "Responded" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusFilter === item.value
                        ? "bg-emerald-700 text-white"
                        : "bg-[#f4faf5] text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-full border border-emerald-100 bg-[#f4faf5] p-1">
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileView === "queue" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Queue
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView("detail")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mobileView === "detail" ? "bg-emerald-700 text-white" : "text-slate-600"
                  }`}
                >
                  Detail
                </button>
              </div>

              {mobileView === "queue" ? (
                <div className="space-y-2.5">
                  {mobileRows.length > 0 ? (
                    mobileRows.map((item) => {
                      const isActive = selectedMessageId === item.id;
                      const status = String(item.status || "new").toLowerCase();

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void openMessage(item)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
                            isActive
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-emerald-100 bg-[#f0f8f2]"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[status] || "bg-gray-100 text-gray-700"}`}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="truncate text-xs text-slate-500">{item.subject || "No subject"}</p>
                          <p className="mt-1 truncate text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                        </button>
                      );
                    })
                  ) : (
                    <p className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-3 text-sm text-slate-500">
                      No messages found.
                    </p>
                  )}

                  {filteredMessages.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllMobileRows((prev) => !prev)}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      {showAllMobileRows
                        ? "Show fewer messages"
                        : `Show all ${filteredMessages.length} messages`}
                    </button>
                  ) : null}
                </div>
              ) : selectedMessage ? (
                <div className="space-y-4 rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900">
                        {selectedMessage.subject || "Contact Message"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Received {formatDateTime(selectedMessage.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteMessage(selectedMessage.id)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 rounded-xl border border-emerald-100 bg-white p-3">
                    <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span className="truncate">{selectedMessage.email}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <MessageSquare className="h-4 w-4 text-slate-500" />
                      <span>{selectedMessage.phone || "No phone"}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white p-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedMessage.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600">Update status:</span>
                    {[
                      { value: "new", label: "New" },
                      { value: "read", label: "Read" },
                      { value: "responded", label: "Responded" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => void updateStatus(item.value)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          String(selectedMessage.status || "new").toLowerCase() === item.value
                            ? "bg-emerald-700 text-white"
                            : "bg-white text-slate-600"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileView("queue")}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    Back to inbox
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] px-3 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-900">Select a message</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open any inquiry from queue to view details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid xl:grid-cols-[36%_64%]">
          <div className="rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_30px_rgba(15,64,28,0.08)]">
            <div className="border-b border-emerald-100 p-4">
              <p className="text-lg font-bold text-slate-900">Inbox</p>
              <p className="text-sm text-slate-500">
                {filteredMessages.length} messages · {unreadCount} unread
              </p>
            </div>

            <div className="border-b border-emerald-100 p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search messages..."
                  className="w-full rounded-xl border border-emerald-100 py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="flex items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "new", label: "New" },
                  { value: "read", label: "Read" },
                  { value: "responded", label: "Responded" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                      statusFilter === item.value
                        ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                        : "bg-emerald-100 text-slate-600 hover:bg-emerald-200/70 hover:text-emerald-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[64vh] overflow-y-auto">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((item) => {
                  const isActive = selectedMessageId === item.id;
                  const status = String(item.status || "new").toLowerCase();
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openMessage(item)}
                      className={`w-full border-b border-emerald-100 px-4 py-3 text-left transition-colors duration-150 ${
                        isActive ? "bg-emerald-50" : "hover:bg-emerald-50/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[status] || "bg-gray-100 text-gray-700"}`}>
                          {status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{item.subject || "No subject"}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                    </button>
                  );
                })
              ) : (
                <p className="p-4 text-sm text-slate-500">No messages found.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
            {selectedMessage ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-slate-900">{selectedMessage.subject || "Contact Message"}</p>
                    <p className="mt-1 text-sm text-slate-500">Received {formatDateTime(selectedMessage.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteMessage(selectedMessage.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-100 bg-[#f0f8f2] p-4 sm:grid-cols-2">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{selectedMessage.email}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                    <span>{selectedMessage.phone || "No phone"}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedMessage.message}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">Update status:</span>
                  {[
                    { value: "new", label: "New" },
                    { value: "read", label: "Read" },
                    { value: "responded", label: "Responded" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => void updateStatus(item.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                        selectedMessage.status === item.value
                          ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                          : "bg-emerald-100 text-slate-600 hover:bg-emerald-200/70 hover:text-emerald-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-slate-900">Select a Message</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Choose any inquiry from the left panel to review customer details and update status.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
