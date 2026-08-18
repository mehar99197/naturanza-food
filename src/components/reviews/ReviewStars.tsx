/**
 * The two star rows the reviews section renders, ported from
 * `ProductReviews.jsx`.
 *
 * They were one function there — `renderStars(rating, interactive, ...)` — but
 * only ever called non-interactively (line 210, inside a review card). The form
 * had its own copy inlined, with different sizing (`h-6 w-6` against `h-5 w-5`)
 * and different handlers. So the `interactive` branch of `renderStars` was
 * unreachable, and the two components below are the two shapes that actually
 * rendered. The DOM each emits is byte-identical to the original.
 *
 * ONE ODDITY IS PRESERVED ON PURPOSE. The display row is built from `<button>`
 * elements with no `type`, no handler and no label — `renderStars` passed
 * `type={interactive ? 'button' : undefined}`, and React omits an attribute set
 * to undefined. A typeless button defaults to `type="submit"`, so this would
 * submit the enclosing form if one of these rows ever moved inside the review
 * form. It does not today (the cards sit below the form, not within it), so the
 * markup is carried across unchanged rather than quietly corrected — see the
 * note in the return value.
 */

import { Star } from "lucide-react";

import { REVIEW_STARS } from "./mapReview";

/** Read-only rating display, as rendered inside a review card. */
export function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {REVIEW_STARS.map((starValue) => (
        <button key={starValue} className="cursor-default">
          <Star
            className={`h-5 w-5 ${starValue <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export interface ReviewRatingPickerProps {
  rating: number;
  hoverRating: number;
  onSelect: (rating: number) => void;
  onHover: (rating: number) => void;
  onLeave: () => void;
}

/**
 * The "Your Rating" picker inside the review form.
 *
 * `hoverRating || rating` is the original's preview rule: hovering shows what
 * you would pick, and falls back to what you have picked. `onMouseLeave` sits on
 * the wrapper rather than on each star so sliding between two stars does not
 * flicker the row back to the committed value.
 */
export function ReviewRatingPicker({
  rating,
  hoverRating,
  onSelect,
  onHover,
  onLeave,
}: ReviewRatingPickerProps) {
  return (
    <div className="mb-4" onMouseLeave={onLeave}>
      <p className="mb-2 text-sm font-medium text-gray-700">Your Rating</p>
      <div className="flex items-center gap-1">
        {REVIEW_STARS.map((starValue) => (
          <button
            key={starValue}
            type="button"
            onMouseEnter={() => onHover(starValue)}
            onFocus={() => onHover(starValue)}
            onClick={() => onSelect(starValue)}
            className=""
            aria-label={`Rate ${starValue} stars`}
          >
            <Star
              className={`h-6 w-6 ${starValue <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
