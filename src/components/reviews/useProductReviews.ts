"use client";

/**
 * List state and submission for the reviews section.
 *
 * This is the half of the port that changed shape. In the Vite app the work was
 * split across two files: `ProductReviews.jsx` owned the "show all" toggle and
 * the form, while `ProductDetail.jsx` owned the fetch (`fetchProductReviews`)
 * and the submit (`handleSubmitReview`) and passed them down as `mockReviews`
 * and `onSubmitReview`. The Next contract gives `<ProductReviews>` server-fetched
 * data and no callbacks, so both halves land here.
 *
 * WHAT THE NETWORK IS STILL USED FOR, AND WHAT IT IS NOT. The mount-time fetch
 * is gone — the first page of reviews arrives as props, rendered into the server
 * HTML where a crawler can read it. The only two remaining requests are the ones
 * a reader triggers: expanding the list past what the server sent, and posting a
 * review.
 *
 * `reviewEvents` is the singleton bus from @/lib/reviewEvents. Emitting on it is
 * not decoration: `WishlistProvider` subscribes, and it has had no publisher in
 * `src/` since the migration began, because ProductDetail.jsx was the only one.
 * This restores the wire.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { reviewAPI } from "@/lib/api";
import { isApiError, isRecord } from "@/lib/api/errors";
import { loginUrlFor } from "@/lib/returnTo";
import reviewEvents from "@/lib/reviewEvents";
import { useAuth } from "@/providers/AuthProvider";

import { toProductReviews } from "./mapReview";
import type { ProductReview, ReviewSummary } from "./types";

/** What the form collects. The rest of a review is the server's to decide. */
export interface NewReviewInput {
  rating: number;
  comment: string;
}

export interface ReviewFeedback {
  tone: "success" | "error";
  message: string;
}

/** `POST /api/reviews` echoes the row it inserted; the bus forwards it on. */
interface SubmitReviewResponse {
  message?: string;
  review?: unknown;
}

const SUBMIT_FALLBACK_ERROR = "Failed to submit review. Please try again.";

/**
 * `error.response?.data?.error || error.message || <fallback>`, which is the
 * chain ProductDetail.jsx used, written against `ApiError` instead of axios.
 */
const submitErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    const data: unknown = error.response?.data;
    if (isRecord(data) && typeof data.error === "string" && data.error) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return SUBMIT_FALLBACK_ERROR;
};

export interface UseProductReviewsOptions {
  productId: number;
  initialReviews: ProductReview[];
  initialSummary: ReviewSummary;
}

export interface UseProductReviewsResult {
  reviews: ProductReview[];
  /** Every approved review, not just the loaded page — drives the button count. */
  totalCount: number;
  showAllReviews: boolean;
  isLoadingAll: boolean;
  toggleShowAllReviews: () => void;
  submitReview: (input: NewReviewInput) => Promise<void>;
  feedback: ReviewFeedback | null;
}

export const useProductReviews = ({
  productId,
  initialReviews,
  initialSummary,
}: UseProductReviewsOptions): UseProductReviewsResult => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [totalCount, setTotalCount] = useState<number>(initialSummary.totalCount);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);

  /**
   * Guards the fetch against a double click. A ref rather than `isLoadingAll`
   * because the flag is read inside a callback that would otherwise close over
   * a stale value between renders.
   */
  const isFetchingRef = useRef(false);

  /**
   * Adopts fresh props only when the *product* changes, not whenever the parent
   * re-renders. Depending on `initialReviews` alone would reset an expanded list
   * every time a new array reference arrived from above.
   */
  const loadedProductIdRef = useRef(productId);
  useEffect(() => {
    if (loadedProductIdRef.current === productId) return;
    loadedProductIdRef.current = productId;
    setReviews(initialReviews);
    setTotalCount(initialSummary.totalCount);
    setShowAllReviews(false);
    setFeedback(null);
  }, [productId, initialReviews, initialSummary.totalCount]);

  const toggleShowAllReviews = useCallback(() => {
    if (showAllReviews) {
      setShowAllReviews(false);
      return;
    }

    // The server sent a page, not the whole set. Collapse-and-expand should not
    // refetch, so this only fires while something is still missing.
    if (reviews.length >= totalCount || isFetchingRef.current) {
      setShowAllReviews(true);
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingAll(true);

    void reviewAPI
      .getProductReviews(productId)
      .then((rows) => {
        const mapped = toProductReviews(rows);
        setReviews(mapped);
        setTotalCount(mapped.length);
      })
      .catch((error: unknown) => {
        // ProductDetail.jsx blanked the list when its fetch failed. That was the
        // *initial* fetch, which no longer exists; blanking here would throw
        // away reviews the server already rendered — and the SEO content with
        // them — to report a failure the reader can retry by clicking again.
        console.error("Error fetching reviews:", error);
      })
      .finally(() => {
        isFetchingRef.current = false;
        setIsLoadingAll(false);
        setShowAllReviews(true);
      });
  }, [productId, reviews.length, showAllReviews, totalCount]);

  const submitReview = useCallback(
    async ({ rating, comment }: NewReviewInput): Promise<void> => {
      // Defensive: the form only renders for a signed-in reader. Kept because
      // ProductDetail.jsx kept it, and a session can expire while the form sits
      // open.
      if (!isAuthenticated) {
        setFeedback({ tone: "error", message: "Please login to submit a review" });
        router.push(loginUrlFor(`/product/${productId}`));
        return;
      }

      try {
        const data = await reviewAPI.submitReview<SubmitReviewResponse>({
          product_id: productId,
          rating: Number(rating || 0),
          comment: comment || "",
        });

        reviewEvents.reviewSubmitted({ productId, review: data.review });

        // The list is deliberately not updated: `routes/reviews.js` inserts with
        // `is_approved = 0`, so the new review is not public yet and showing it
        // would promise a visibility it does not have.
        setFeedback({
          tone: "success",
          message: "Review submitted and is awaiting approval.",
        });
      } catch (error) {
        console.error("Error submitting review:", error);
        setFeedback({ tone: "error", message: submitErrorMessage(error) });
      }
    },
    [isAuthenticated, productId, router],
  );

  return {
    reviews,
    totalCount,
    showAllReviews,
    isLoadingAll,
    toggleShowAllReviews,
    submitReview,
    feedback,
  };
};
