import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Star, Trash2 } from "lucide-react";
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

  const reviews = Array.isArray(data) ? data : [];
  const fetchError = swrError
    ? swrError?.response?.data?.error || swrError?.message || "Failed to load product reviews"
    : "";
  const error = mutationError || fetchError;
  const setError = setMutationError;

  const loadReviews = async () => {
    invalidateSWRKey(CACHE_KEY);
    await refresh();
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

        {/* Stats Card */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Reviews</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{reviews.length}</p>
        </div>

        {/* Reviews List */}
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
          <div className="mb-4">
            <p className="text-lg font-bold text-slate-900">All Product Reviews</p>
          </div>

          <div className="space-y-3">
            {reviews.length > 0 ? (
              <>
                {reviews.map((item, index) => {
                  const isSaving = savingIds.has(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`${!showAllMobileRows && index >= 5 ? "hidden md:block" : "block"} rounded-xl border border-emerald-100 bg-[#f0f8f2] p-4`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <p className="text-base font-semibold text-slate-900">
                            {item.product_name || "Unknown Product"}
                          </p>
                          <p className="text-sm text-slate-500">
                            by {item.customer_name || "Anonymous"} ({item.customer_email || "no-email"})
                          </p>
                          <div className="mt-2 flex items-center gap-1">{renderStars(item.rating)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
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

                      {item.comment && (
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {item.comment}
                        </p>
                      )}
                    </article>
                  );
                })}

                {reviews.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileRows((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 md:hidden"
                  >
                    {showAllMobileRows
                      ? "Show fewer reviews"
                      : `Show all ${reviews.length} reviews`}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">No reviews found.</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
