"use client";

/**
 * The "Write a Review" form and the mobile toggle above it, ported from the
 * signed-in branch of `ProductReviews.jsx`.
 *
 * The form is `hidden md:block` until the toggle flips it, which is why the
 * toggle is `md:hidden`: on a phone the form is collapsed by default so the
 * reviews themselves are what you land on; from `md` up it is always open and
 * the toggle does not exist.
 *
 * FORM STATE STAYS HERE rather than in `useProductReviews`. The rating, the
 * hover preview and the comment are this component's business and nothing else
 * reads them; hoisting them would put a re-render on every keystroke through the
 * whole reviews section.
 *
 * THE CLEAR-ON-FAILURE BEHAVIOUR IS PRESERVED, and it is a pre-existing bug. In
 * the original, `handleSubmit` reset the form immediately after awaiting
 * `onSubmitReview`, and ProductDetail's `handleSubmitReview` caught its own
 * errors without rethrowing — so a submission that failed (a network drop, a
 * 403 from the purchase check) still wiped the comment the reader had typed.
 * `submitReview` here resolves the same way for the same reason, so the reset
 * still runs. Reported rather than fixed; see the return value.
 */

import { useState } from "react";
import type { FormEvent } from "react";

import { ReviewRatingPicker } from "./ReviewStars";
import type { NewReviewInput } from "./useProductReviews";

export interface ReviewComposerProps {
  onSubmit: (input: NewReviewInput) => Promise<void>;
}

export function ReviewComposer({ onSubmit }: ReviewComposerProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!rating || !comment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit({ rating, comment: comment.trim() });

      setRating(0);
      setHoverRating(0);
      setComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowReviewForm((prev) => !prev)}
        className="md:hidden mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
      >
        {showReviewForm ? "Hide Review Form" : "Write a Review"}
      </button>

      <form
        onSubmit={handleSubmit}
        className={`mb-6 md:mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm ${showReviewForm ? "block" : "hidden md:block"}`}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Write a Review</h3>

        <ReviewRatingPicker
          rating={rating}
          hoverRating={hoverRating}
          onSelect={setRating}
          onHover={setHoverRating}
          onLeave={() => setHoverRating(0)}
        />

        <div className="mb-4">
          <label
            htmlFor="review-comment"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Your Comment
          </label>
          <textarea
            id="review-comment"
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share your experience with this product..."
            className="w-full rounded-lg border-gray-200 bg-gray-50 p-4 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!rating || !comment.trim() || isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </>
  );
}
