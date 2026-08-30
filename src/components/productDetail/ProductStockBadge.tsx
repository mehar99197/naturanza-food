import { Check, Package } from "lucide-react";

import type { ProductDetailVariant } from "./types";

/**
 * The in-stock / out-of-stock pill.
 *
 * WHAT HAPPENED TO "(N left)". The SPA appended a remaining-units count here,
 * but only on the branch where the payload carried no `is_in_stock` boolean:
 *
 *     hasExplicitAvailability = typeof product.is_in_stock === 'boolean'
 *     maxAllowedQty = !hasExplicitAvailability && stock > 0 ? stock : null
 *
 * productController.js strips `stock_quantity` and `reserved_stock` and always
 * publishes `is_in_stock`, so `hasExplicitAvailability` was true for every
 * product the storefront ever received and `maxAllowedQty` was always null. The
 * count never rendered on the live site. Exact inventory is not public data —
 * `Product` in @/types/catalog omits both columns on purpose — so this renders
 * the branch that actually ran rather than reinstating a leak.
 */
export interface ProductStockBadgeProps {
  isInStock: boolean;
  variant: ProductDetailVariant;
}

export function ProductStockBadge({ isInStock, variant }: ProductStockBadgeProps) {
  const isMobile = variant === "mobile";
  const iconClass = isMobile ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={
        isMobile
          ? "mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          : "mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
      }
    >
      {isInStock ? <Check className={iconClass} /> : <Package className={iconClass} />}
      {isInStock ? "In stock" : "Out of stock"}
    </div>
  );
}
