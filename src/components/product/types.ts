/**
 * The product shape ProductCard accepts.
 *
 * WHY IT IS SPELLED TWICE: the same card is rendered from two sources that
 * disagree about casing, and both are correct for where they sit.
 *
 *   Server Components (Home, Shop, the product page) hold the mapped domain type
 *   from @/types/catalog — `imageUrl`, `categoryName`, `discountPercentage`.
 *
 *   Client Components hold the raw JSON the Express API returns — `image_url`,
 *   `category_name`, `discount_percentage` — because it is never mapped on the
 *   way through `productAPI`.
 *
 * Rather than a union of the two (which would force every read through a type
 * guard and make a third caller shape a breaking change), this is a *structural*
 * interface: every field optional, both spellings declared. `Product` and
 * `ProductWithCategory` are assignable to it as-is, and so is any raw row. It
 * extends `PriceableProduct` so `getProductPricing` — which already reads both
 * discount spellings — takes it directly.
 *
 * The trade-off is deliberate: an all-optional interface will accept an object
 * that is not a product at all. TypeScript's weak-type check still requires at
 * least one property in common, which catches the genuinely wrong argument, and
 * the alternative (required fields) would break the moment a caller holds a
 * wishlist row keyed by `product_id` with no `id` — which ProfileWishlist does.
 *
 * Deliberately absent: `image`. It is not part of either published shape; the
 * card reads it defensively for legacy payloads, via the image resolver.
 */

import type { PriceableProduct } from "@/lib/pricing";

/** One entry of a product's `images` array, in either casing. */
export interface ProductCardImageEntry {
  /** Raw API shape. */
  image_url?: string | null;
  /** Some payloads use a bare `url`. */
  url?: string | null;
  /** Mapped domain shape (`ProductImage` from @/types/catalog). */
  imageUrl?: string | null;
}

export interface ProductCardProduct extends PriceableProduct {
  id?: string | number | null;
  /** Present instead of `id` on wishlist and cart rows. */
  product_id?: string | number | null;
  name?: string | null;
  description?: string | null;
  /** Raw API shape. */
  image_url?: string | null;
  /** Mapped domain shape. */
  imageUrl?: string | null;
  /** Legacy payloads only. */
  image?: string | null;
  images?: ReadonlyArray<string | ProductCardImageEntry> | null;
  /** Raw API shape. */
  category_name?: string | null;
  /** Mapped domain shape. */
  categoryName?: string | null;
  /** Free-text category on payloads that carry no join. */
  category?: string | null;
  /** "Bestseller" | "Featured" | "New" | "Sale"; anything else gets the orange pill. */
  badge?: string | null;
  review_count?: number | string | null;
  reviewCount?: number | string | null;
  average_rating?: number | string | null;
  averageRating?: number | string | null;
  rating?: number | string | null;
}

export type ProductCardViewMode = "grid" | "list";
