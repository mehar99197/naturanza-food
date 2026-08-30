"use client";

/**
 * Totals, free-delivery progress and the checkout actions at the bottom of the
 * cart drawer, lifted out of frontend/src/components/CartDrawer.jsx.
 *
 * The original wrapped the free-delivery block in an IIFE purely to get local
 * bindings inside JSX; here those are ordinary consts above the return. The
 * emitted markup is unchanged.
 *
 * Routing: the "Proceed to Checkout" react-router `<Link to="/checkout">` is now
 * `next/link` at the same URL. It keeps its `onClick` so the drawer closes as
 * navigation starts — without it the drawer stays mounted over the checkout page.
 *
 * Note the two different totals. `totalPrice` already includes each product's own
 * discount; `storeSaleDiscount` is the *extra* reduction a store-wide sale adds on
 * top, and only for products whose own discount is smaller. Showing the struck-out
 * `totalPrice` beside the discounted figure is the only place a customer sees that
 * second reduction before checkout.
 */

import Link from "next/link";
import { ArrowRight, Truck, ShieldCheck } from "lucide-react";

import { formatPrice } from "@/lib/utils";

/** Free-delivery threshold used when settings carry no usable value. */
const DEFAULT_FREE_SHIPPING_THRESHOLD = 5000;

export interface CartDrawerFooterProps {
  totalItems: number;
  currency: string;
  /** `settings.shippingFree` — a string, as the settings API publishes it. */
  shippingFree: string | number | null | undefined;
  storeDiscountLabel: string;
  /** Cart total with per-product discounts already applied. */
  normalizedTotalPrice: number;
  /** Extra reduction from an active store-wide sale, 0 when none is running. */
  storeSaleDiscount: number;
  /** `normalizedTotalPrice` minus `storeSaleDiscount`, floored at 0. */
  discountedTotal: number;
  onClearCart: () => void;
  onCheckoutNavigate: () => void;
}

export function CartDrawerFooter({
  totalItems,
  currency,
  shippingFree,
  storeDiscountLabel,
  normalizedTotalPrice,
  storeSaleDiscount,
  discountedTotal,
  onClearCart,
  onCheckoutNavigate,
}: CartDrawerFooterProps) {
  const threshold =
    Number(shippingFree) || DEFAULT_FREE_SHIPPING_THRESHOLD;
  const remaining = Math.max(0, threshold - discountedTotal);
  const pct = Math.min(100, (discountedTotal / threshold) * 100);
  const qualified = remaining === 0;

  return (
    <div className="shrink-0 border-t border-slate-200/80 bg-white/92 p-4 backdrop-blur-xl sm:p-6">
      {/* Free shipping progress — advance payment only (not COD) */}
      <div className="mb-3.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2.5">
        {qualified ? (
          <p className="text-[12px] font-semibold text-emerald-700 text-center">
            🎉 Free delivery unlocked for advance payments!
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-[11px] text-slate-500">
              Add <span className="font-bold text-emerald-700">{formatPrice(remaining, currency)}</span> more for <span className="font-semibold text-emerald-700">free delivery</span>{' '}
              <span className="text-slate-400">(advance payment)</span>
            </p>
            <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </div>
      <div className="mb-3.5 rounded-xl sm:rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-white via-emerald-50/50 to-green-50/70 px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Order Total</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {totalItems} item{totalItems === 1 ? '' : 's'} ready for checkout
            </p>
          </div>
          <div className="text-right">
            {storeSaleDiscount > 0 && (
              <p className="text-xs text-slate-400 line-through">
                {formatPrice(normalizedTotalPrice, currency)}
              </p>
            )}
            <p className="font-display text-xl font-bold text-slate-800">
              {formatPrice(discountedTotal, currency)}
            </p>
          </div>
        </div>
        {storeSaleDiscount > 0 && (
          <p className="mt-2 text-center text-[11px] font-semibold text-rose-600">
            🎉 {storeDiscountLabel}: you save {formatPrice(storeSaleDiscount, currency)}
          </p>
        )}
      </div>

      <div className="mb-3.5 flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>Secure checkout with protected payments.</span>
        <Truck className="h-4 w-4 text-emerald-600" />
      </div>

      <div className="mt-1 grid grid-cols-[2fr_3fr] items-center gap-2 sm:flex sm:items-center sm:justify-between">
        <button
          onClick={onClearCart}
          className="inline-flex min-h-[40px] w-full sm:w-auto sm:flex-none items-center justify-center rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50/70 px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-100/80"
        >
          Clear Cart
        </button>

        <Link
          href="/checkout"
          onClick={onCheckoutNavigate}
          className="inline-flex min-h-[40px] w-full sm:w-auto sm:flex-1 items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
        >
          Proceed to Checkout
          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Link>
      </div>
    </div>
  );
}
