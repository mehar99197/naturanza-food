"use client";

/**
 * The customer reviews section of the product page, ported from
 * `frontend/src/components/ProductReviews.jsx` together with the review half of
 * `frontend/src/pages/ProductDetail.jsx`.
 *
 * "use client" DOES NOT MEAN "NOT IN THE HTML". This is the point worth being
 * clear about, because reviews are the SEO payload of a product page. A Client
 * Component still renders on the server for the initial request; what the
 * directive buys is hydration afterwards. So the first page of approved reviews
 * — handed in as `initialReviews`, queried by the page through
 * @/server/catalog/reviews — is in the markup a crawler receives, which is
 * exactly what the old `useEffect` fetch put *out* of it. The network is touched
 * only when a reader expands the list or posts a review.
 *
 * The directive sits here rather than deeper because everything below the
 * heading is stateful: the form, the toggle, and the list itself, which grows
 * when expanded. Splitting it further would put a boundary between the list and
 * the state that slices it.
 *
 * PROPS CHANGED WITH THE MOVE. The original took `isLoggedIn`, `user`,
 * `mockReviews`, `onLoginClick` and `onSubmitReview` from ProductDetail. Auth
 * now comes from `useAuth`, and the two callbacks are owned by
 * `useProductReviews`; what remains is data the server fetched.
 *
 * `user` is gone entirely. It was read only to stamp a name and an avatar onto
 * the optimistic local review that `mockReviews.length > 0` made unreachable —
 * ProductDetail always passed a non-empty list once any review existed, and the
 * server never returns the pending review anyway. That whole branch, along with
 * the `Date.now()` id it minted, is dropped as dead code.
 */

import { useAuth } from "@/providers/AuthProvider";

import { ReviewComposer } from "./ReviewComposer";
import { ReviewList } from "./ReviewList";
import { ReviewLoginPrompt } from "./ReviewLoginPrompt";
import { useProductReviews } from "./useProductReviews";
import type { ProductReview, ReviewSummary } from "./types";

/**
 * How many reviews show before the reader expands the list. Preserved from the
 * original's `displayedReviews.slice(0, 3)`.
 */
const COLLAPSED_REVIEW_COUNT = 3;

export interface ProductReviewsProps {
  productId: number;
  /** First page of approved reviews, rendered into the server HTML. */
  initialReviews: ProductReview[];
  /** Aggregates over every approved review, not just the page above. */
  initialSummary: ReviewSummary;
}

export function ProductReviews({
  productId,
  initialReviews,
  initialSummary,
}: ProductReviewsProps) {
  const { isAuthenticated } = useAuth();
  const {
    reviews,
    totalCount,
    showAllReviews,
    isLoadingAll,
    toggleShowAllReviews,
    submitReview,
    feedback,
  } = useProductReviews({ productId, initialReviews, initialSummary });

  const visibleReviews = showAllReviews
    ? reviews
    : reviews.slice(0, COLLAPSED_REVIEW_COUNT);

  return (
    <section className="mt-8 md:mt-10 rounded-2xl bg-[#fdfdfb] p-4 sm:p-6 md:p-8">
      <h2 className="mb-4 md:mb-6 border-b border-gray-200 pb-3 md:pb-4 text-[1.75rem] md:text-2xl font-bold text-gray-900">
        Customer Reviews
      </h2>

      {!isAuthenticated ? (
        <ReviewLoginPrompt productId={productId} />
      ) : (
        <ReviewComposer onSubmit={submitReview} />
      )}

      {/*
        The original reported both outcomes through ProductDetail's page-level
        toast, which this component has no access to under the new prop contract.
        An inline status line replaces it: same wording, and it persists instead
        of vanishing after two seconds, so a failure message is still readable by
        someone using a screen reader or retyping a lost comment.
      */}
      {feedback ? (
        <p
          role="status"
          className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "bg-green-50 text-green-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <ReviewList reviews={visibleReviews} />

      {/*
        `md:hidden` on the toggle while the slice above applies at every width —
        carried across from the original, bug included. See the return value.
      */}
      {totalCount > COLLAPSED_REVIEW_COUNT ? (
        <div className="mt-4 md:hidden">
          <button
            type="button"
            onClick={toggleShowAllReviews}
            disabled={isLoadingAll}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingAll
              ? "Loading Reviews..."
              : showAllReviews
                ? "Show Less Reviews"
                : `Show All Reviews (${totalCount})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default ProductReviews;
