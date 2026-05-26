import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { reviewAPI } from "@/services/api";
import { reviewEvents, REVIEW_EVENTS } from "@/utils/reviewEvents";

const renderStars = (rating) => {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));
  const filled = Math.round(normalized);

  return Array.from({ length: 5 }).map((_, index) => (
    <Star
      key={`star-${index}`}
      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${index < filled ? "text-amber-500 fill-amber-500" : "text-gray-300"}`}
    />
  ));
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

export function ProfileReviews() {
  const { user } = useAuth();
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyReviews = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      if (!user) {
        setMyReviews([]);
        return;
      }

      const data = await reviewAPI.getMyReviews();
      setMyReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching my reviews:', error);
      setMyReviews([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user]);

  // Initial fetch on mount
  useEffect(() => {
    void fetchMyReviews();
  }, [fetchMyReviews]);

  // Listen for review submission events
  useEffect(() => {
    const refreshMyReviews = () => {
      void fetchMyReviews({ silent: true });
    };

    const intervalId = window.setInterval(refreshMyReviews, 15000);
    const handleWindowFocus = () => refreshMyReviews();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshMyReviews();
      }
    };
    const unsubscribeSubmitted = reviewEvents.on(REVIEW_EVENTS.REVIEW_SUBMITTED, refreshMyReviews);
    const unsubscribeUpdated = reviewEvents.on(REVIEW_EVENTS.REVIEW_UPDATED, refreshMyReviews);
    const unsubscribeDeleted = reviewEvents.on(REVIEW_EVENTS.REVIEW_DELETED, refreshMyReviews);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeSubmitted();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [fetchMyReviews]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-8 border border-gray-100">
        <div className="py-8 sm:py-10 text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2.5 sm:mb-3 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-8 border border-gray-100">
      {myReviews.length === 0 ? (
        <div className="py-8 sm:py-10 text-center">
          <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2.5 sm:mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No reviews yet</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-5">
            Your submitted product reviews will appear here.
          </p>
          <Link
            to="/shop"
            className="inline-flex min-h-[42px] items-center justify-center px-4 sm:px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-4">
          {myReviews.map((review, index) => (
            <article
              key={review.id || `${review.product_id}-${index}`}
              className="rounded-xl border border-gray-100 p-3 sm:p-4 hover:border-green-200 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Product Image */}
                {review.product_image && (
                  <img
                    src={review.product_image}
                    alt={review.product_name || 'Product'}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs sm:text-sm text-gray-500">{formatDate(review.created_at)}</p>
                    <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                  </div>

                  <Link
                    to={`/product/${review.product_id}`}
                    className="block text-[15px] sm:text-base font-semibold text-gray-900 hover:text-green-700 line-clamp-1 mb-2"
                  >
                    {review.product_name || `Product #${review.product_id}`}
                  </Link>

                  <p className="text-sm text-gray-700 leading-relaxed break-words">
                    {review.comment || "No comment added."}
                  </p>

                  {/* Approval Status */}
                  {review.is_approved === 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
                      Pending Approval
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfileReviews;
