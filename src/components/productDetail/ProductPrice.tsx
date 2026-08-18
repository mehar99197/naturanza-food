"use client";

/**
 * The price block: current price, struck-through list price, discount pill and
 * the amount saved.
 *
 * WHY THIS LEAF IS A CLIENT COMPONENT while the panel around it is not. Two of
 * its three inputs live in the settings context, which is client-side by
 * necessity: the store-wide sale can be switched on by an admin, and the
 * display currency is detected from the visitor's own location after the page
 * loads. Server-rendering a converted price would bake one visitor's currency
 * into a cached page. So this is the smallest subtree that has to be a client
 * component, and everything above it stays on the server.
 *
 * On the first paint — server render and hydration alike — the provider is
 * still holding DEFAULT_SETTINGS, so both sides render PKR and the markup
 * matches. The currency swap happens afterwards, in an effect.
 *
 * `getProductPricing` is the only source of the discounted figure. It reads
 * both `discountPercentage` and `discount_percentage`, and it is what decides
 * that a store-wide sale replaces a product's own discount rather than stacking
 * with it. Recomputing any of that here is how a customer ends up seeing one
 * price and being charged another.
 */

import { formatPrice, getProductPricing } from "@/lib/utils";
import type { PriceableProduct } from "@/lib/pricing";
import { useSettings } from "@/providers/SettingsProvider";

import type { ProductDetailVariant } from "./types";

export interface ProductPriceProps {
  product: PriceableProduct;
  variant: ProductDetailVariant;
}

export function ProductPrice({ product, variant }: ProductPriceProps) {
  const { settings } = useSettings();
  const pricing = getProductPricing(product, settings);
  const isMobile = variant === "mobile";

  return (
    <>
      <div
        className={
          isMobile
            ? "mt-3 flex flex-wrap items-center gap-2"
            : "mt-4 flex flex-wrap items-center gap-2.5"
        }
      >
        <span
          className={
            isMobile
              ? "text-3xl font-extrabold text-emerald-700"
              : "text-[2.1rem] font-extrabold text-emerald-700"
          }
        >
          {formatPrice(pricing.salePrice, settings.currency)}
        </span>

        {pricing.onSale ? (
          <>
            <span
              className={
                isMobile
                  ? "text-base text-gray-400 line-through"
                  : "text-lg text-gray-400 line-through"
              }
            >
              {formatPrice(pricing.base, settings.currency)}
            </span>
            <span
              className={`rounded-full bg-gradient-to-r from-rose-500 to-red-600 px-2.5 ${
                isMobile ? "py-0.5" : "py-1"
              } text-xs font-bold text-white`}
            >
              {pricing.effectivePct}% OFF
            </span>
            <span
              className={`rounded-full bg-red-100 ${
                isMobile ? "px-2 py-0.5" : "px-2.5 py-1"
              } text-xs font-bold text-red-600`}
            >
              Save {formatPrice(pricing.saved, settings.currency)}
            </span>
          </>
        ) : null}
      </div>

      {/* Only the mobile panel carries the sale banner line. Preserved as found. */}
      {isMobile && pricing.onSale && settings.storeDiscountActive ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
          🎉 {settings.storeDiscountLabel} — limited time
        </p>
      ) : null}
    </>
  );
}
