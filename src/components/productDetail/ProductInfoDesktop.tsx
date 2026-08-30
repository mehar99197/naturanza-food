import type { ProductWithCategory } from "@/types/catalog";

import { ProductActionsDesktop } from "./ProductActionsDesktop";
import { ProductKeyBenefits } from "./ProductKeyBenefits";
import { ProductMeta } from "./ProductMeta";
import { ProductPrice } from "./ProductPrice";
import { ProductRatingStars } from "./ProductRatingStars";
import { ProductStockBadge } from "./ProductStockBadge";
import { ProductDesktopBadgeRow } from "./ProductTrustBadges";
import { toActionsProduct } from "./toActionsProduct";
import type { ProductRatingSummary } from "./types";

/**
 * The desktop buy panel — the sticky card in the right-hand column.
 *
 * A Server Component, for the same reasons as its phone counterpart: the price
 * and the buy controls are the only parts that need the browser.
 *
 * This is where the page's `<h1>` lives.
 */
export interface ProductInfoDesktopProps {
  product: ProductWithCategory;
  summary: ProductRatingSummary;
  /** First paragraph of the resolved description, or "" if there is none. */
  descriptionLead: string;
}

export function ProductInfoDesktop({
  product,
  summary,
  descriptionLead,
}: ProductInfoDesktopProps) {
  return (
    <div className="sticky top-28 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
      <h1 className="text-4xl font-bold leading-tight text-[#213121]">{product.name}</h1>

      <ProductRatingStars summary={summary} variant="desktop" />
      {/* Only the two fields pricing reads cross the boundary — see
          toActionsProduct for why props to a client component are kept narrow. */}
      <ProductPrice
        product={{ price: product.price, discountPercentage: product.discountPercentage }}
        variant="desktop"
      />
      <ProductStockBadge isInStock={product.isInStock} variant="desktop" />
      <ProductMeta barcode={product.barcode} />

      <p className="mt-4 text-[15px] leading-relaxed text-gray-600">
        {descriptionLead || "No description added yet for this product."}
      </p>

      <ProductKeyBenefits />

      <ProductActionsDesktop product={toActionsProduct(product)} />
      <ProductDesktopBadgeRow />
    </div>
  );
}
