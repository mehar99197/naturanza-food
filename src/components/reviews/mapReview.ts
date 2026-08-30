/**
 * Turning a review row into the shape a card renders, ported from the mapping
 * `ProductDetail.jsx` did inline in `fetchProductReviews`, plus `formatDate`
 * from `ProductReviews.jsx`.
 *
 * It is one module rather than two copies because the server query and the
 * browser's "show all" fetch return identical column names (see `ReviewRow`).
 * Two copies would drift, and the drift would show up as reviews that render
 * differently depending on whether you scrolled or clicked.
 *
 * No directive: imported by both a `server-only` module and a Client Component.
 */

import { getAbsoluteImageUrl } from "@/lib/imageUtils";

import type {
  ProductReview,
  ReviewRow,
  ReviewStarBreakdown,
  ReviewStarRating,
} from "./types";

/**
 * Explicit, not the ambient locale. A bare `toLocaleDateString()` formats with
 * whatever locale the environment happens to have, which differs between the
 * Node process and the browser and would produce a hydration mismatch on a date
 * that is otherwise identical. "en-US" is what ProductReviews.jsx passed.
 */
export const REVIEW_DATE_LOCALE = "en-US";

const REVIEW_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/** The five star values, in ascending order, as a typed tuple to map over. */
export const REVIEW_STARS: readonly ReviewStarRating[] = [1, 2, 3, 4, 5];

/** True for a number that is a valid star value. */
export const isReviewStar = (value: number): value is ReviewStarRating =>
  Number.isInteger(value) && value >= 1 && value <= 5;

/** A breakdown with every bucket at zero. */
export const emptyStarBreakdown = (): ReviewStarBreakdown => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
});

/**
 * "Aug 18, 2026", or the input untouched when it will not parse.
 *
 * The fall-through to the raw value is preserved from `ProductReviews.jsx`,
 * which returned `dateValue` for an unparseable date so a malformed timestamp
 * showed as itself rather than "Invalid Date". Null and undefined render as
 * nothing, as they did there.
 */
export const formatReviewDate = (
  value: Date | string | null | undefined,
): string => {
  if (value === null || value === undefined) return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(REVIEW_DATE_LOCALE, REVIEW_DATE_OPTIONS);
};

/**
 * The mapping ProductDetail.jsx applied to every row, unchanged — including the
 * "Guest User" default and the `Number(... || 0)` coercions, which matter
 * because MySQL hands `rating` back as a number but JSON has been seen to carry
 * it as a string.
 */
export const toProductReview = (row: ReviewRow): ProductReview => ({
  id: Number(row.id),
  name: row.customer_name || "Guest User",
  rating: Number(row.rating || 0),
  date: formatReviewDate(row.created_at),
  comment: row.comment || "",
  userAvatar: getAbsoluteImageUrl(row.customer_image),
});

/** Maps a payload that should be an array of rows, tolerating one that is not. */
export const toProductReviews = (rows: unknown): ProductReview[] =>
  Array.isArray(rows) ? (rows as ReviewRow[]).map(toProductReview) : [];
