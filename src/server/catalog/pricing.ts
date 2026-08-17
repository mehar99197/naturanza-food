import type { Product } from "@/types/catalog";

/**
 * Display pricing for a product.
 *
 * This mirrors getProductPricing in frontend/src/lib/utils.js exactly, including
 * the 90% clamp and the rule that an active store-wide sale replaces the
 * product's own discount only when it is larger — never stacks with it. The two
 * implementations must agree: a migrated page and an unmigrated one show the
 * same price for the same product, and the backend applies the same rule when
 * the order is actually charged.
 *
 * Deliberately not rounded. The existing UI formats at the point of display, and
 * rounding here would shift totals by a rupee against the server's arithmetic.
 */

/** Discounts are clamped to 0–90% wherever they come from. */
export const clampPercent = (value: unknown): number =>
  Math.min(Math.max(Number(value) || 0, 0), 90);

/** The store-wide sale settings that can override a product's own discount. */
export interface StoreDiscountSettings {
  storeDiscountActive: boolean;
  storeDiscountPercentage: number;
  storeDiscountLabel: string;
}

export interface ProductPricing {
  /** List price before any discount. */
  base: number;
  salePrice: number;
  /** The discount actually applied, as a whole percentage. */
  effectivePct: number;
  onSale: boolean;
  saved: number;
  label: string;
}

export const getProductPricing = (
  product: Pick<Product, "price" | "discountPercentage">,
  settings?: Partial<StoreDiscountSettings> | null,
): ProductPricing => {
  const base = Number(product.price) || 0;
  const perProductPct = clampPercent(product.discountPercentage);
  const storePct = settings?.storeDiscountActive
    ? clampPercent(settings.storeDiscountPercentage)
    : 0;

  const effectivePct = Math.max(perProductPct, storePct);
  const salePrice = effectivePct > 0 ? base - (base * effectivePct) / 100 : base;

  return {
    base,
    salePrice,
    effectivePct: Math.round(effectivePct),
    onSale: effectivePct > 0 && salePrice < base,
    saved: base - salePrice,
    label: settings?.storeDiscountLabel || "Sale",
  };
};
