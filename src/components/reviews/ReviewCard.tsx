/**
 * One review, ported from the `<article>` inside `ProductReviews.jsx`.
 *
 * The avatar stays a plain `<img>` rather than `next/image`, for the same reason
 * `CartLineItem` and `UserMenu` keep theirs: the src is a user-uploaded file
 * whose intrinsic size nobody knows, and it may resolve to a third-party origin
 * (a Google sign-in avatar), which `next/image` would reject without a
 * `remotePatterns` entry in `next.config.ts`. Width and height are fixed by the
 * `h-10 w-10` class, so no layout shift comes of it.
 *
 * `review.date` arrives already formatted — see `ProductReview.date` for why it
 * cannot be formatted here.
 */

import { ReviewStars } from "./ReviewStars";
import type { ProductReview } from "./types";

export function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <article className="rounded-xl bg-white p-4 md:p-6 shadow-sm">
      <div className="flex items-start gap-3">
        {review.userAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.userAvatar}
            alt={review.name || "Reviewer"}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
            {String(review.name || "U").charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{review.name}</p>
              <p className="text-xs text-gray-500">{review.date}</p>
            </div>
            <ReviewStars rating={review.rating} />
          </div>

          <p className="mt-3 text-gray-600">{review.comment}</p>
        </div>
      </div>
    </article>
  );
}
