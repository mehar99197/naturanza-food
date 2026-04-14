import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Star, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { adminAPI } from "@/services/api";

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

export function AdminReviews() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingIds, setSavingIds] = useState(new Set());
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (statusFilter === "approved") {
        params.status = "approved";
      }
      if (statusFilter === "pending") {
        params.status = "pending";
      }

      const response = await adminAPI.getReviews(params);
      setReviews(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to load product reviews",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const approveCounts = useMemo(() => {
    const approved = reviews.filter((item) => Number(item.is_approved) === 1).length;
    const pending = reviews.length - approved;
    return { approved, pending };
  }, [reviews]);

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [statusFilter]);

  const updateApproval = async (reviewId, isApproved) => {
    try {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.add(reviewId);
        return next;
      });

      await adminAPI.updateReviewApproval(reviewId, isApproved);
      await loadReviews();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update review");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={3} rows={7} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 sm:text-3xl">Review Moderation</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Approve or hold customer reviews directly from your live database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="inline-flex h-9 self-end items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:self-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
            <div className="grid grid-cols-3 gap-1.5">
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Total</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-gray-900">{reviews.length}</p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Approved</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-emerald-700">{approveCounts.approved}</p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Pending</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-amber-600">{approveCounts.pending}</p>
              </article>
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Reviews</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{reviews.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Approved</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{approveCounts.approved}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{approveCounts.pending}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-gray-900">All Product Reviews</p>
            <div className="flex items-center gap-2">
              {[
                { value: "all", label: "All" },
                { value: "approved", label: "Approved" },
                { value: "pending", label: "Pending" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatusFilter(item.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusFilter === item.value
                      ? "bg-[#2a5f1e] text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {reviews.length > 0 ? (
              <>
                {reviews.map((item, index) => {
                const isApproved = Number(item.is_approved) === 1;
                const isSaving = savingIds.has(item.id);

                return (
                  <article
                    key={item.id}
                    className={`${!showAllMobileRows && index >= 5 ? "hidden md:block" : "block"} rounded-xl border border-gray-100 bg-gray-50 p-4`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {item.product_name || "Unknown Product"}
                        </p>
                        <p className="text-sm text-gray-500">
                          by {item.customer_name || "Anonymous"} ({item.customer_email || "no-email"})
                        </p>
                        <div className="mt-2 flex items-center gap-1">{renderStars(item.rating)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isApproved
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isApproved ? "Approved" : "Pending"}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-gray-700">
                      {item.comment || "No review comment provided."}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving || isApproved}
                        onClick={() => void updateApproval(item.id, true)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || !isApproved}
                        onClick={() => void updateApproval(item.id, false)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Mark Pending
                      </button>
                    </div>
                  </article>
                );
                })}

                {reviews.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMobileRows((prev) => !prev)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:hidden"
                  >
                    {showAllMobileRows
                      ? "Show fewer reviews"
                      : `Show all ${reviews.length} reviews`}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">No reviews found for this filter.</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
