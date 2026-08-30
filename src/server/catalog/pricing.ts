/**
 * Pricing moved to @/lib/pricing because both server and client code need it —
 * a Client Component importing from a `server/` path reads as a layering
 * mistake, and the rules are identical either way.
 *
 * Re-exported here so existing server-side imports keep working.
 */
export {
  clampPercent,
  getProductPricing,
  type PriceableProduct,
  type ProductPricing,
  type StoreDiscountSettings,
} from "@/lib/pricing";
