/**
 * Types and pure helpers behind WishlistProvider, ported from
 * `frontend/src/context/WishlistContext.jsx`.
 *
 * Ids are compared as trimmed strings throughout, because the same product
 * arrives as a number from `/products` and as a string from `/wishlist`; a
 * `===` on the raw values silently reports "not in wishlist" for every item.
 */

/**
 * A wishlist row. The API returns the whole product joined onto the row, so the
 * index signature carries the rest of the columns for the card that renders it.
 */
export interface WishlistItem {
  id?: string | number | null;
  product_id?: string | number | null;
  name?: string | null;
  [key: string]: unknown;
}

/** What a product card hands to `addToWishlist` / `toggleWishlist`. */
export interface WishlistProduct {
  id?: string | number | null;
  product_id?: string | number | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface WishlistMutationResult {
  success: boolean;
  /** Set when the action was refused because nobody is signed in. */
  requiresAuth?: boolean;
  message?: string;
}

export type ProductIdInput = string | number | null | undefined;

/** Window event other components fire to ask the wishlist to re-read itself. */
export const WISHLIST_UPDATED_EVENT = "wishlistUpdated";

export const normalizeProductId = (value: unknown): string =>
  String(value ?? "").trim();

export const extractItemProductId = (
  item: WishlistItem | null | undefined,
): string => normalizeProductId(item?.product_id ?? item?.id);

/**
 * Announces a wishlist change to every other listener in the tab.
 *
 * Guarded for server rendering. It is only ever called from an event handler,
 * so the guard cannot fire in practice — it is here so the module stays safe if
 * a future caller reaches it during render.
 */
export const emitWishlistUpdated = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(WISHLIST_UPDATED_EVENT));
};
