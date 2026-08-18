/**
 * The grid of review cards, ported from the `<div className="grid gap-4
 * sm:gap-5">` in `ProductReviews.jsx`.
 *
 * Its own file because the shell hands it a *slice* — the original showed three
 * reviews until the reader expanded the list — and keeping the slicing decision
 * in the shell and the rendering here means neither has to know about the other.
 */

import { ReviewCard } from "./ReviewCard";
import type { ProductReview } from "./types";

export function ReviewList({ reviews }: { reviews: readonly ProductReview[] }) {
  return (
    <div className="grid gap-4 sm:gap-5">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}
