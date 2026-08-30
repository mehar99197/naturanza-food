import "server-only";

import {
  emptyStarBreakdown,
  isReviewStar,
  toProductReview,
} from "@/components/reviews/mapReview";
import type {
  ProductReview,
  ReviewRow,
  ReviewSummary,
} from "@/components/reviews/types";
import { queryRows } from "@/server/db/query";

/**
 * Read access to product reviews for server-rendered pages.
 *
 * Replaces the client-side `GET /api/reviews/product/:id` call that
 * ProductDetail.jsx fired on mount. Reviews are indexable content — the ratings
 * and the prose are a large part of what a product page is worth to search — and
 * a fetch in `useEffect` puts all of it outside the HTML a crawler reads. The
 * page now queries this module directly and hands the result to
 * `<ProductReviews>` as props.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE:
 *
 *   1. Only approved reviews are ever selected. `is_approved` defaults to FALSE
 *      and `routes/reviews.js` inserts new reviews with 0, so an unmoderated
 *      review is a submission nobody has vetted yet. `SELECT *` plus a forgotten
 *      predicate is exactly how that reaches a product page, so the filter lives
 *      in one constant used by both queries.
 *
 *   2. Named columns only, and none of them identify the reviewer beyond a
 *      display name and an avatar. The `users` join has `email` and the review
 *      row has `user_id` sitting right there; neither is selected, so no edit to
 *      a component downstream can publish one.
 *
 * There is no soft-delete column on `reviews` — checked against
 * `backend/schema/database.sql` and every file in `backend/schema/migrations/`.
 * Deletion is a hard DELETE, cascaded from `products` and `users`. The `JOIN
 * users` therefore also acts as the "reviewer still exists" filter, which is why
 * the summary query carries the same join as the list query even though it needs
 * no column from it: without it the two could disagree about the total.
 */

/** The one place the moderation state is spelled. Both queries use it. */
const APPROVED = "r.is_approved = 1";

const REVIEW_COLUMNS = `r.id, r.rating, r.comment, r.created_at,
  u.name AS customer_name, u.profile_image AS customer_image`;

/**
 * How many reviews a page ships in its HTML when it does not ask for a count.
 *
 * Only the first three are visible until the reader expands the list, so ten is
 * headroom: it covers the expansion without a network round trip for the great
 * majority of products, and stays small enough that the RSC payload does not
 * grow with a product's popularity.
 */
export const REVIEWS_PAGE_SIZE = 10;

const MAX_LIMIT = 100;

const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(Number(limit) || REVIEWS_PAGE_SIZE, 1), MAX_LIMIT);

/** Rejects an id that would make the query pointless before it is sent. */
const isValidProductId = (productId: number): boolean =>
  Number.isInteger(productId) && productId > 0;

export type {
  ProductReview,
  ReviewSummary,
  ReviewRow,
  ReviewStarBreakdown,
  ReviewStarRating,
} from "@/components/reviews/types";

/**
 * The most recent approved reviews for a product, newest first.
 *
 * `routes/reviews.js` orders by `created_at DESC` alone. The tiebreak on `id`
 * added here makes the order total rather than arbitrary, so two renders of the
 * same page cannot emit reviews in different orders — which would otherwise show
 * up as a diff in the cached HTML for no reason.
 */
export const listProductReviews = async (
  productId: number,
  limit?: number,
): Promise<ProductReview[]> => {
  if (!isValidProductId(productId)) return [];

  const rows = await queryRows<ReviewRow>(
    `SELECT ${REVIEW_COLUMNS}
       FROM reviews r
       JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND ${APPROVED}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?`,
    [productId, clampLimit(limit)],
  );

  return rows.map(toProductReview);
};

/**
 * Average, total and per-star counts over every approved review.
 *
 * One `GROUP BY` rather than a `COUNT` plus an `AVG` plus five more counts: the
 * grouped row set is at most five rows, and deriving all three figures from it
 * in JavaScript keeps them consistent with each other by construction.
 *
 * The average is computed here from `rating * count` instead of using SQL `AVG`
 * so it is an exact JavaScript number rather than a DECIMAL string, and matches
 * what ProductDetail.jsx computed by reducing over the fetched array.
 */
export const getReviewSummary = async (
  productId: number,
): Promise<ReviewSummary> => {
  const breakdown = emptyStarBreakdown();

  if (!isValidProductId(productId)) {
    return { averageRating: 0, totalCount: 0, breakdown };
  }

  const rows = await queryRows<{ rating: number | string; total: number | string }>(
    `SELECT r.rating AS rating, COUNT(*) AS total
       FROM reviews r
       JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND ${APPROVED}
      GROUP BY r.rating`,
    [productId],
  );

  let totalCount = 0;
  let ratingSum = 0;

  for (const row of rows) {
    const star = Number(row.rating);
    const count = Number(row.total);
    if (!Number.isFinite(star) || !Number.isFinite(count) || count <= 0) continue;

    totalCount += count;
    ratingSum += star * count;
    if (isReviewStar(star)) {
      breakdown[star] += count;
    }
  }

  return {
    averageRating: totalCount > 0 ? ratingSum / totalCount : 0,
    totalCount,
    breakdown,
  };
};
