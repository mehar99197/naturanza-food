import { Star } from "lucide-react";

import type { ProductDetailVariant, ProductRatingSummary } from "./types";

/**
 * The five-star row with the numeric average and the review count.
 *
 * A Server Component: it renders a number the server already knows. The SPA
 * fetched the reviews from the browser and left this row showing "0.0 (0
 * reviews)" until that request landed, which is also what a crawler saw.
 *
 * PRESERVED AS FOUND — the SPA's fallback for a product with no reviews was
 * `Number(product?.rating || 0)`, but `rating` is not a column and the products
 * API has never published it, so that expression was always 0. An unreviewed
 * product therefore shows an empty five-star row and "0.0", exactly as before.
 */

/** Five fixed slots, so the row is a plain map rather than `[...Array(5)]`. */
const STAR_SLOTS = [0, 1, 2, 3, 4];

export interface ProductRatingStarsProps {
  summary: ProductRatingSummary;
  variant: ProductDetailVariant;
}

export function ProductRatingStars({ summary, variant }: ProductRatingStarsProps) {
  const isMobile = variant === "mobile";
  const rounded = Math.round(summary.averageRating);

  return (
    <div
      className={
        isMobile ? "mt-2 flex items-center gap-2 text-sm" : "mt-3 flex items-center gap-2"
      }
    >
      <div className="flex items-center gap-0.5 text-amber-500">
        {STAR_SLOTS.map((index) => (
          <Star
            key={index}
            className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} ${
              index < rounded ? "fill-current" : ""
            }`}
          />
        ))}
      </div>
      <span className={isMobile ? "font-semibold text-gray-700" : "text-sm font-semibold text-gray-700"}>
        {summary.averageRating.toFixed(1)}
      </span>
      <span className={isMobile ? "text-gray-500" : "text-sm text-gray-500"}>
        ({summary.reviewCount} reviews)
      </span>
    </div>
  );
}
