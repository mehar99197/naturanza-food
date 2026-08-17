/**
 * Field readers for a cart line, extracted verbatim from the closures inside
 * frontend/src/components/CartDrawer.jsx.
 *
 * They live outside the component because none of them close over anything but
 * their argument (only `getUnitPrice` needs settings, which is passed in), and
 * because CartDrawer.tsx would otherwise blow past the 300-line ceiling.
 *
 * Every reader is defensive about spelling for the same reason the original was:
 * a line can arrive from `/cart` (product_id, image_url, category_name) or be
 * handed straight from a product card before the server has confirmed it
 * (id, image, category). `CartItem`'s index signature is what lets both through,
 * and is also why the alternate spellings type as `unknown` and go through
 * `asText` rather than being read directly.
 */

import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import { getProductPricing, type MoneyInput } from "@/lib/utils";
import type { StoreDiscountSettings } from "@/lib/pricing";
import type { CartItem } from "@/providers/CartProvider";

/** Shown when a line has no usable image, and when its image 404s. */
export const FALLBACK_CART_IMAGE = "/images/products/honey.webp";

/**
 * `String(value)` for anything real, "" for null/undefined — so a missing field
 * stays falsy and the `||` chains below fall through exactly as they did in JS.
 */
const asText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/** First argument that is neither null nor undefined. */
const firstPresent = (...values: unknown[]): unknown =>
  values.find((value) => value !== null && value !== undefined);

export const getProductId = (item: CartItem): string | number =>
  item.product_id ?? item.id;

export const getImageSrc = (item: CartItem): string => {
  const imageValue = item.image_url || asText(item.image) || "";
  if (!imageValue) return FALLBACK_CART_IMAGE;
  // getAbsoluteImageUrl turns a bare filename or a stale absolute URL into a
  // path against the origin that actually serves /images today.
  return getAbsoluteImageUrl(imageValue, { defaultFolder: "products" });
};

/**
 * What one unit costs today.
 *
 * `getProductPricing` decides whether a store-wide sale beats the line's own
 * discount; when nothing is on sale the server's `final_price` wins over the
 * list price, because that is the figure checkout will charge.
 */
export const getUnitPrice = (
  item: CartItem,
  settings?: Partial<StoreDiscountSettings> | null,
): MoneyInput => {
  const pricing = getProductPricing(item, settings);
  return pricing.onSale ? pricing.salePrice : (item.final_price ?? item.price);
};

export const getItemName = (item: CartItem): string =>
  item.name || asText(item.product_name) || "Product";

export const getCategoryLabel = (item: CartItem): string =>
  asText(item.category_name) || asText(item.category) || "Naturanza Essentials";

/**
 * React key for a line.
 *
 * The cart *line* id leads, not the product id: the same product can legitimately
 * appear twice under different variants, and keying by product would make React
 * reuse one row's DOM for the other. The index tail is the last-resort tiebreak
 * for a payload that carries neither.
 */
export const getItemKey = (item: CartItem, index: number): string => {
  const productId = getProductId(item);
  const cartLineId = firstPresent(
    item.cart_item_id,
    item.cart_id,
    item.cartItemId,
    item.id,
  );
  const variantId = firstPresent(item.variant_id, item.variantId) ?? "default";
  return `${cartLineId ?? productId ?? "cart"}-${variantId}-${index}`;
};
