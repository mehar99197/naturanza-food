import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Star, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminAPI } from "@/services/api";
import { useSWRCache, invalidateSWRKey } from "@/hooks/useSWRCache";

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const renderStars = (rating = 0) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      className={`h-4 w-4 ${index < safeRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
    />
  ));
};

const CACHE_KEY = "admin:reviews";

export function AdminReviews() {
  const [savingIds, setSavingIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [mutationError, setMutationError] = useState("");

  // SWR: cached data renders instantly on re-visit; background refresh keeps it fresh.
  const {
    data,
    loading,
    revalidating,
    error: swrError,
    refresh,
  } = useSWRCache(CACHE_KEY, () => adminAPI.getReviews({}));

  const reviews = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const pendingCount = useMemo(
    () => reviews.filter((item) => !item.is_approved).length,
    [reviews],
  );
  const approvedCount = useMemo(
    () => reviews.filter((item) => Boolean(item.is_approved)).length,
    [reviews],
  );
  const filteredReviews = useMemo(() => {
    if (statusFilter === "pending") {
      return reviews.filter((item) => !item.is_approved);
    }
    if (statusFilter === "approved") {
      return reviews.filter((item) => Boolean(item.is_approved));
    }
    return reviews;
  }, [reviews, statusFilter]);

  const fetchError = swrError
    ? swrError?.response?.data?.error || swrError?.message || "Failed to load product reviews"
    : "";
  const error = mutationError || fetchError;
  const setError = setMutationError;

  const loadReviews = async () => {
    invalidateSWRKey(CACHE_KEY);
    await refresh();
  };

  const toggleReviewApproval = async (review) => {
    const nextApproved = !review.is_approved;
    try {
      setError("");
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.add(review.id);
        return next;
      });

      await adminAPI.updateReviewApproval(review.id, nextApproved);
      await loadReviews();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          `Failed to ${nextApproved ? "approve" : "unapprove"} review`,
      );
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(review.id);
        return next;
      });
    }
  };

  const deleteReview = async (reviewId) => {
    if (!confirm("Are you sure you want to delete this review? This action cannot be undone.")) {
      return;
    }

    try {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.add(reviewId);
        return next;
      });

      await adminAPI.deleteReview(reviewId);
      await loadReviews();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete review");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Customer Reviews</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              View and manage all customer product reviews.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="inline-flex h-10 self-end items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:self-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading || revalidating ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Reviews</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{reviews.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending Approval</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Approved</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{approvedCount}</p>
          </div>
        </div>

        {/* Reviews List */}
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-bold text-slate-900">Product Reviews</p>
            <div className="inline-flex rounded-xl border border-emerald-100 bg-slate-50 p-1">
              {[
                { key: "all", label: `All (${reviews.length})` },
                { key: "pending", label: `Pending (${pendingCount})` },
                { key: "approved", label: `Approved (${approvedCount})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setShowAllMobileRows(false);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === tab.key
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredReviews.length > 0 ? (
              <>
                {filteredReviews.map((item, index) => {
                  const isSaving = savingIds.has(item.id);
                  const isApproved = Boolean(item.is_approved);

                  return (
                    <article
                      key={item.id}
                      className={`${!showAllMobileRows && index >= 5 ? "hidden md:block" : "block"} rounded-xl border border-emerald-100 bg-[#f0f8f2] p-4`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">
                              {item.product_name || "Unknown Product"}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isApproved
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {isApproved ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approved
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">
                            by {item.customer_name || "Anonymous"} ({item.customer_email || "no-email"})
                          </p>
                          <div className="mt-2 flex items-center gap-1">{renderStars(item.rating)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void toggleReviewApproval(item)}
                              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                                isApproved
                                  ? "bg-amber-600 hover:bg-amber-700"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                            >
                              {isApproved ? (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  Unapprove
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Approve
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void deleteReview(item.id)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {item.comment && (
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {item.comment}
                        </p>
                      )}
                    </article>
                  );
                })}

                {filteredReviews.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileRows((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 md:hidden"
                  >
                    {showAllMobileRows
                      ? "Show fewer reviews"
                      : `Show all ${filteredReviews.length} reviews`}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                {statusFilter === "all"
                  ? "No reviews found."
                  : `No ${statusFilter} reviews found.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
