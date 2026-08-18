import type { ProductWithCategory } from "@/types/catalog";

import { ProductActionsMobile } from "./ProductActionsMobile";
import { ProductMeta } from "./ProductMeta";
import { ProductPrice } from "./ProductPrice";
import { ProductRatingStars } from "./ProductRatingStars";
import { ProductStockBadge } from "./ProductStockBadge";
import { ProductMobileTrustRow } from "./ProductTrustBadges";
import { toActionsProduct } from "./toActionsProduct";
import type { ProductRatingSummary } from "./types";

/**
 * The phone information card: name, rating, price, availability, product code,
 * the opening paragraph, then the buy controls and the delivery reassurances.
 *
 * A Server Component. Only two children cross into the browser — the price
 * (which needs the visitor's currency and the live store sale) and the buy
 * controls (which need cart and wishlist). Everything else, including the
 * product copy, is rendered here and never re-rendered on the client.
 *
 * PRESERVED AS FOUND: the name is a `<p>`, not a heading. The page's only `<h1>`
 * is in the desktop panel, which is `hidden md:block` — present in the DOM on a
 * phone but not painted. Changing it would be a markup redesign, so it stays.
 */
export interface ProductInfoMobileProps {
  product: ProductWithCategory;
  summary: ProductRatingSummary;
  /** First paragraph of the resolved description, or "" if there is none. */
  descriptionLead: string;
}

export function ProductInfoMobile({
  product,
  summary,
  descriptionLead,
}: ProductInfoMobileProps) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="text-[1.85rem] font-bold leading-tight text-[#233023]">{product.name}</p>

      <ProductRatingStars summary={summary} variant="mobile" />
      {/* Only the two fields pricing reads cross the boundary — see
          toActionsProduct for why props to a client component are kept narrow. */}
      <ProductPrice
        product={{ price: product.price, discountPercentage: product.discountPercentage }}
        variant="mobile"
      />
      <ProductStockBadge isInStock={product.isInStock} variant="mobile" />
      <ProductMeta barcode={product.barcode} />

      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {descriptionLead || "No description added yet for this product."}
      </p>

      <ProductActionsMobile product={toActionsProduct(product)} />
      <ProductMobileTrustRow />
    </div>
  );
}
