import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { announcementAPI } from "@/services/api";

const initialFormState = {
  title: "",
  message: "",
  type: "info",
  is_active: true,
  start_date: "",
  end_date: "",
};

const typeOptions = [
  {
    value: "info",
    label: "Info",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "success",
    label: "Success",
    badge: "border-emerald-200 bg-emerald-100/70 text-emerald-900",
  },
  {
    value: "warning",
    label: "Warning",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "danger",
    label: "Danger",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
  },
  {
    value: "promotion",
    label: "Promotion",
    badge:
      "border-emerald-400/60 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white",
  },
];

const previewStyles = {
  info: {
    shell: "border-emerald-200/70 bg-white/90 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-100 text-emerald-700",
    titlePill: "bg-emerald-100 text-emerald-800",
    message: "text-emerald-900/90",
    counter: "bg-emerald-100/70 text-emerald-800",
  },
  success: {
    shell: "border-emerald-200/70 bg-emerald-50/80 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-200/70 text-emerald-800",
    titlePill: "bg-emerald-200/70 text-emerald-900",
    message: "text-emerald-900/90",
    counter: "bg-emerald-200/70 text-emerald-900",
  },
  warning: {
    shell: "border-amber-200/70 bg-amber-50/85 text-amber-900 shadow-[0_8px_18px_rgba(217,119,6,0.12)]",
    icon: "bg-amber-100 text-amber-700",
    titlePill: "bg-amber-100 text-amber-900",
    message: "text-amber-900/90",
    counter: "bg-amber-100/80 text-amber-800",
  },
  danger: {
    shell: "border-rose-200/70 bg-rose-50/85 text-rose-900 shadow-[0_8px_18px_rgba(225,29,72,0.12)]",
    icon: "bg-rose-100 text-rose-700",
    titlePill: "bg-rose-100 text-rose-900",
    message: "text-rose-900/90",
    counter: "bg-rose-100/80 text-rose-800",
  },
  promotion: {
    shell: "border-emerald-600/30 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-[0_12px_26px_rgba(16,185,129,0.24)]",
    icon: "bg-white/15 text-amber-200",
    titlePill: "bg-white/15 text-amber-100",
    message: "text-white",
    counter: "bg-white/15 text-white",
  },
};

const previewIcons = {
  info: Info,
  success: Tag,
  warning: AlertCircle,
  danger: AlertCircle,
  promotion: Sparkles,
};

const findTypeMeta = (type) =>
  typeOptions.find((option) => option.value === type) || typeOptions[0];

const truncateMessage = (value, maxLength = 60) => {
  const trimmed = String(value || "").trim();
  if (trimmed.length <= maxLength) {
    return trimmed || "-";
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "Open";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const toDateTimeLocal = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (part) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [validationErrors, setValidationErrors] = useState({});

  const loadAnnouncements = async () => {
    try {
      setError("");
      const response = await announcementAPI.getAll();
      setAnnouncements(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Could not load announcements right now.",
      );
    }
  };

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const activeCount = useMemo(
    () => announcements.filter((item) => Boolean(item.is_active)).length,
    [announcements],
  );

  const promotionCount = useMemo(
    () => announcements.filter((item) => item.type === "promotion").length,
    [announcements],
  );

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setFormData(initialFormState);
    setValidationErrors({});
    setError("");
    setShowModal(true);
  };

  const openEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: String(announcement.title || ""),
      message: String(announcement.message || ""),
      type: String(announcement.type || "info"),
      is_active: Boolean(announcement.is_active),
      start_date: toDateTimeLocal(announcement.start_date),
      end_date: toDateTimeLocal(announcement.end_date),
    });
    setValidationErrors({});
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData(initialFormState);
    setValidationErrors({});
  };

  const validateForm = () => {
    const nextErrors = {};
    const title = String(formData.title || "").trim();
    const message = String(formData.message || "").trim();

    if (!title) {
      nextErrors.title = "Title is required.";
    }

    if (!message) {
      nextErrors.message = "Message is required.";
    }

    if (formData.start_date && Number.isNaN(new Date(formData.start_date).getTime())) {
      nextErrors.start_date = "Start date must be valid.";
    }

    if (formData.end_date && Number.isNaN(new Date(formData.end_date).getTime())) {
      nextErrors.end_date = "End date must be valid.";
    }

    if (
      formData.start_date &&
      formData.end_date &&
      new Date(formData.end_date).getTime() < new Date(formData.start_date).getTime()
    ) {
      nextErrors.end_date = "End date must be after the start date.";
    }

    return nextErrors;
  };

  const handleSave = async () => {
    const nextErrors = validateForm();
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      title: String(formData.title || "").trim(),
      message: String(formData.message || "").trim(),
      type: formData.type,
      is_active: Boolean(formData.is_active),
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    try {
      setSaving(true);
      setError("");

      if (editingAnnouncement) {
        await announcementAPI.update(editingAnnouncement.id, payload);
      } else {
        await announcementAPI.create(payload);
      }

      closeModal();
      await loadAnnouncements();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Could not save the announcement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (announcement) => {
    if (
      !window.confirm(
        `Delete the "${announcement.title}" announcement permanently?`,
      )
    ) {
      return;
    }

    try {
      setError("");
      await announcementAPI.delete(announcement.id);
      await loadAnnouncements();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Could not delete the announcement.",
      );
    }
  };

  const selectedType = findTypeMeta(formData.type);
  const previewMeta = previewStyles[formData.type] || previewStyles.info;
  const PreviewIcon = previewIcons[formData.type] || Info;
  const previewTitle = String(formData.title || "Announcement").trim() || "Announcement";
  const previewMessage =
    String(formData.message || "Share the latest store updates for shoppers.").trim() ||
    "Share the latest store updates for shoppers.";

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">
              Announcements
            </h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Manage the announcement bar shoppers see above the storefront navigation.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => void loadAnnouncements()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-3 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          </div>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                  Total
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {announcements.length}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Megaphone className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">
              Total campaigns and service notices
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                  Active
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-700">
                  {activeCount}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">
              Enabled announcements ready for the storefront
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                  Promotions
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {promotionCount}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">
              Offer-driven announcements with premium styling
            </p>
          </article>
        </div>

        <section className="rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_34px_rgba(15,64,28,0.1)] md:overflow-hidden">
          <div className="border-b border-emerald-100 bg-[#f8faf7] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">Announcement Library</p>
                <p className="text-sm text-slate-500">
                  Titles are shown as bold prefixes, while messages are the main shopper-facing copy.
                </p>
              </div>
              <span className="hidden rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
                {announcements.length} total
              </span>
            </div>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {announcements.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-10 text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Megaphone className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-900">
                  No announcements yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first store notice, delivery update, or promotional banner.
                </p>
              </div>
            ) : (
              announcements.map((announcement) => {
                const typeMeta = findTypeMeta(announcement.type);
                return (
                  <article
                    key={announcement.id}
                    className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900">
                          {announcement.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {truncateMessage(announcement.message, 120)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeMeta.badge}`}
                      >
                        {typeMeta.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-emerald-100 bg-[#f7fbf7] p-2.5">
                        <p className="text-slate-500">Status</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {announcement.is_active ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-[#f7fbf7] p-2.5">
                        <p className="text-slate-500">Starts</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {formatDateTime(announcement.start_date)}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-xl border border-emerald-100 bg-[#f7fbf7] p-2.5">
                        <p className="text-slate-500">Ends</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {formatDateTime(announcement.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(announcement)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(announcement)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="border-b border-emerald-100 bg-[#f2f8f2] text-left text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-4 py-4">Message</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Start Date</th>
                  <th className="px-4 py-4">End Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <Megaphone className="h-6 w-6" />
                        </div>
                        <p className="text-base font-semibold text-slate-900">
                          No announcements yet
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Start with a seasonal promotion, shipping note, or service update.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  announcements.map((announcement) => {
                    const typeMeta = findTypeMeta(announcement.type);
                    return (
                      <tr
                        key={announcement.id}
                        className="group border-b border-emerald-50 transition-colors duration-200 hover:bg-emerald-50/45"
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">
                            {announcement.title}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {truncateMessage(announcement.message)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${typeMeta.badge}`}
                          >
                            {typeMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                              announcement.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                announcement.is_active
                                  ? "bg-emerald-600"
                                  : "bg-slate-500"
                              }`}
                            />
                            {announcement.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatDateTime(announcement.start_date)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatDateTime(announcement.end_date)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(announcement)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition-colors duration-200 hover:bg-emerald-50"
                              aria-label={`Edit ${announcement.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(announcement)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-50"
                              aria-label={`Delete ${announcement.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showModal && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[120] overflow-hidden">
                <div className="absolute -inset-1 bg-slate-950/80 backdrop-blur-lg" />
                <div className="scrollbar-hide relative flex h-full w-full items-end justify-center overflow-y-auto px-0 pb-0 pt-0 sm:items-center sm:px-4 sm:pb-4 sm:pt-[calc(env(safe-area-inset-top)+1.25rem)]">
                  <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-emerald-100">
                    <div className="sticky top-0 z-20 border-b border-emerald-100/90 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-8 sm:py-5 sm:backdrop-blur-none">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[2rem] font-bold tracking-tight text-slate-900 sm:text-2xl">
                            {editingAnnouncement
                              ? "Edit Announcement"
                              : "New Announcement"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Fine-tune visibility, timing, and tone for the storefront announcement bar.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeModal}
                          disabled={saving}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:rounded-2xl"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4 sm:max-h-[72vh] sm:px-8 sm:py-6">
                      <div className="space-y-6">
                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Megaphone className="h-4 w-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                              Content
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Title*
                              </span>
                              <input
                                type="text"
                                value={formData.title}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                  }))
                                }
                                className="h-12 w-full rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                placeholder="Fresh arrivals, delivery update, special offer"
                              />
                              {validationErrors.title ? (
                                <p className="text-xs font-semibold text-red-600">
                                  {validationErrors.title}
                                </p>
                              ) : null}
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Message*
                              </span>
                              <textarea
                                rows={4}
                                value={formData.message}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    message: event.target.value,
                                  }))
                                }
                                className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                placeholder="Share the shopper-facing message that should appear in the announcement bar."
                              />
                              {validationErrors.message ? (
                                <p className="text-xs font-semibold text-red-600">
                                  {validationErrors.message}
                                </p>
                              ) : null}
                            </label>
                          </div>
                        </section>

                        <div className="h-px bg-emerald-100" />

                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Sparkles className="h-4 w-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                              Presentation
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Type
                              </span>
                              <select
                                value={formData.type}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    type: event.target.value,
                                  }))
                                }
                                className="h-12 w-full rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              >
                                {typeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="rounded-2xl border border-emerald-100 bg-[#f7fbf7] px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Preview
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${selectedType.badge}`}
                              >
                                {selectedType.label}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`flex min-h-[38px] items-center gap-2.5 rounded-2xl border px-3 py-2 ${previewMeta.shell}`}
                          >
                            <span
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${previewMeta.icon}`}
                            >
                              <PreviewIcon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${previewMeta.titlePill}`}
                                >
                                  {previewTitle}
                                </span>
                                <p
                                  className={`truncate text-[12px] font-medium leading-tight ${previewMeta.message}`}
                                >
                                  {previewMessage}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex ${previewMeta.counter}`}
                            >
                              Preview
                            </span>
                          </div>
                        </section>

                        <div className="h-px bg-emerald-100" />

                        <section className="space-y-4">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                              Visibility
                            </h3>
                          </div>

                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                            <span>
                              <span className="block text-sm font-semibold text-slate-800">
                                Active
                              </span>
                              <span className="block text-xs text-slate-500">
                                Inactive announcements stay saved but won’t appear publicly.
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  is_active: !prev.is_active,
                                }))
                              }
                              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
                                formData.is_active ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              aria-pressed={formData.is_active}
                              aria-label="Toggle announcement active state"
                            >
                              <span
                                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                  formData.is_active ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </label>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Start Date
                              </span>
                              <input
                                type="datetime-local"
                                value={formData.start_date}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    start_date: event.target.value,
                                  }))
                                }
                                className="h-12 w-full rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              />
                              {validationErrors.start_date ? (
                                <p className="text-xs font-semibold text-red-600">
                                  {validationErrors.start_date}
                                </p>
                              ) : null}
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                End Date
                              </span>
                              <input
                                type="datetime-local"
                                value={formData.end_date}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    end_date: event.target.value,
                                  }))
                                }
                                className="h-12 w-full rounded-2xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              />
                              {validationErrors.end_date ? (
                                <p className="text-xs font-semibold text-red-600">
                                  {validationErrors.end_date}
                                </p>
                              ) : null}
                            </label>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="sticky bottom-0 z-20 border-t border-emerald-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-sm sm:px-8 sm:py-4 sm:backdrop-blur-none">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleSave()}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {saving
                            ? "Saving..."
                            : editingAnnouncement
                              ? "Save Changes"
                              : "Create Announcement"}
                        </button>
                        <button
                          type="button"
                          onClick={closeModal}
                          disabled={saving}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </AdminLayout>
  );
}
