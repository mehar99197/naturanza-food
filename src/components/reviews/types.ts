/**
 * The review shapes shared by the server query layer and the client components.
 *
 * WHY THIS LIVES UNDER components/ AND NOT server/. `ProductReviews` is a Client
 * Component, and `@/server/*` is `server-only` — importing it from the client
 * bundle is a build error. A type-only import would technically erase, but it
 * erases silently, so one dropped `type` keyword turns into a build failure that
 * points at the wrong file. Declaring the shapes in a module with no directive
 * at all removes the trap: both sides import the same file, and neither side can
 * pull a database handle across the boundary by accident.
 *
 * `@/server/catalog/reviews` re-exports `ProductReview` and `ReviewSummary`, so
 * the server-side contract reads the way a server module should; this file is
 * where they are actually defined.
 */

/** A star value. The `reviews.rating` CHECK constraint keeps the column in 1–5. */
export type ReviewStarRating = 1 | 2 | 3 | 4 | 5;

/** How many approved reviews sit at each star value. */
export type ReviewStarBreakdown = Record<ReviewStarRating, number>;

/**
 * One approved review, already shaped for rendering.
 *
 * These are the exact five fields `ProductReviews.jsx` read off a review, under
 * the names ProductDetail.jsx mapped them to. Nothing else is carried, and that
 * is deliberate: the reviewer's email and the raw user id never leave the
 * database layer, so no future edit to a card can leak one into the HTML.
 */
export interface ProductReview {
  id: number;
  /** Reviewer's display name; "Guest User" when the account has none. */
  name: string;
  rating: number;
  /**
   * Already formatted for display, e.g. "Aug 18, 2026".
   *
   * A string rather than a `Date` because this crosses the server/client
   * boundary. Sending the Date would have the server format it in the server's
   * timezone and the browser reformat it in the reader's; where those differ the
   * two strings differ, and React throws away the server HTML for that subtree.
   * Formatting once makes the mismatch impossible — the same reasoning as
   * `BlogCardPost.date` in @/components/blog/postFields.
   */
  date: string;
  comment: string;
  /** Resolved avatar URL, or "" when the reviewer has no profile image. */
  userAvatar: string;
}

/**
 * Aggregates over *every* approved review for a product, not just the page that
 * was fetched — which is why the "Show All Reviews (N)" count and the header's
 * average both read from here rather than from `reviews.length`.
 */
export interface ReviewSummary {
  /**
   * Mean of every approved rating, unrounded, or 0 when there are none.
   * Unrounded because ProductDetail.jsx rounded at the point of display and
   * rounding here would change the star fill it computes.
   */
  averageRating: number;
  /** Total approved reviews, regardless of how many were fetched. */
  totalCount: number;
  breakdown: ReviewStarBreakdown;
}

/**
 * A review row as it arrives from either source, which are the same shape by
 * design: the `SELECT` in @/server/catalog/reviews names the same columns and
 * aliases that `GET /api/reviews/product/:id` does, so one mapper serves both.
 *
 * `created_at` is a `Date` from mysql2 on the server and an ISO string from JSON
 * in the browser; `formatReviewDate` takes either.
 */
export interface ReviewRow {
  id: number;
  rating: number | string | null;
  comment: string | null;
  created_at: Date | string | null;
  customer_name: string | null;
  customer_image: string | null;
}
