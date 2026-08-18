/**
 * Shared prop shapes for the product detail page.
 *
 * `ProductRatingSummary` is deliberately a local, two-field structural type
 * rather than a re-export of `ReviewSummary` from @/server/catalog/reviews. The
 * star row needs an average and a count and nothing else, and stating that here
 * keeps every presentational component in this folder free of a `server-only`
 * import. The one adaptation from `ReviewSummary` happens in page.tsx.
 */

export interface ProductRatingSummary {
  /** Mean of the approved ratings, 0 when there are none. */
  averageRating: number;
  reviewCount: number;
}

/** Which of the two breakpoint layouts a shared component is rendering into. */
export type ProductDetailVariant = "mobile" | "desktop";
