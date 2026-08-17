/**
 * Display pricing for a product. Shared by server and client code.
 *
 * This mirrors getProductPricing in frontend/src/lib/utils.js exactly, including
 * the 90% clamp and the rule that an active store-wide sale replaces a product's
 * own discount only when it is larger — never stacks with it. The Vite app, the
 * migrated pages and the backend must all agree, or a customer sees one price
 * and is charged another.
 *
 * WHY IT ACCEPTS TWO SHAPES: the same product reaches this function under two
 * different casings. Server Components read the database and hold the mapped
 * domain type (`discountPercentage`); Client Components hold the raw JSON the
 * Express API returns (`discount_percentage`). An earlier version took only the
 * camelCase form, so a raw API row silently produced `discountPercentage:
 * undefined` -> 0% off -> the customer charged full price with no error anywhere.
 * Reading both spellings removes that failure mode instead of relying on every
 * call site to remember which shape it is holding.
 *
 * Deliberately not rounded. The UI formats at the point of display, and rounding
 * here would shift totals by a rupee against the server's arithmetic.
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

/** Either casing of the two fields pricing needs. */
export interface PriceableProduct {
  price?: number | string | null;
  /** Mapped domain shape (Server Components). */
  discountPercentage?: number | string | null;
  /** Raw API shape (Client Components). */
  discount_percentage?: number | string | null;
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

/**
 * Reads whichever discount field is present. `??` rather than `||` so an
 * explicit 0 is honoured and does not fall through to the other spelling.
 */
const readDiscount = (product: PriceableProduct): unknown =>
  product.discountPercentage ?? product.discount_percentage;

export const getProductPricing = (
  product: PriceableProduct,
  settings?: Partial<StoreDiscountSettings> | null,
): ProductPricing => {
  const base = Number(product?.price) || 0;
  const perProductPct = clampPercent(readDiscount(product));
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
