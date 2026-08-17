"use client";

/**
 * One line in the cart drawer, lifted out of the `items.map(...)` body in
 * frontend/src/components/CartDrawer.jsx so the drawer itself stays under the
 * file-size ceiling. The markup is byte-identical to the original `<article>`.
 *
 * Everything it renders is computed by the parent, exactly where the original
 * computed it (inside the map, before the JSX). That keeps this component
 * presentational — it holds no state and reads no context.
 *
 * The image is a plain `<img>`, not `next/image`, and deliberately so: the
 * original relies on the `onError` swap to a local fallback, and the sources are
 * arbitrary user-uploaded paths that would each need to clear next.config's
 * remote-pattern allowlist. Preserving the markup here also keeps the drawer's
 * layout identical while the rest of the migration lands.
 */

import type { SyntheticEvent } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";

import { formatPrice, type MoneyInput } from "@/lib/utils";

import { FALLBACK_CART_IMAGE } from "./cartItemFields";

export interface CartLineItemProps {
  productId: string | number;
  itemName: string;
  categoryLabel: string;
  imageSrc: string;
  unitPrice: MoneyInput;
  quantity: number;
  lineTotal: number;
  currency: string;
  onRemove: (productId: string | number) => void;
  onUpdateQuantity: (productId: string | number, quantity: number) => void;
}

export function CartLineItem({
  productId,
  itemName,
  categoryLabel,
  imageSrc,
  unitPrice,
  quantity,
  lineTotal,
  currency,
  onRemove,
  onUpdateQuantity,
}: CartLineItemProps) {
  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = FALLBACK_CART_IMAGE;
  };

  return (
    <article
      className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/85 p-2.5 sm:p-3.5 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/40"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 hidden h-16 w-16 rounded-full bg-emerald-100/40 blur-xl sm:block" />
      <div className="flex gap-2.5 sm:gap-3">
        <div className="h-[72px] w-[72px] sm:h-[84px] sm:w-[84px] shrink-0 overflow-hidden rounded-lg sm:rounded-xl border border-slate-100 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={itemName}
            onError={handleImageError}
            className="h-full w-full object-contain p-1.5 sm:p-2"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="mb-0.5 line-clamp-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-emerald-700/90">
                {categoryLabel}
              </p>
              <h4 className="line-clamp-2 text-[15px] sm:text-sm font-semibold leading-snug text-slate-800">{itemName}</h4>
            </div>
            <button
              onClick={() => onRemove(productId)}
              className="inline-flex h-7 w-7 sm:h-auto sm:w-auto items-center justify-center rounded-lg border border-rose-100 p-0 sm:p-1.5 text-rose-500 transition-colors duration-200 hover:bg-rose-50"
              aria-label={`Remove ${itemName} from cart`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
            <p className="text-base font-bold text-emerald-700">
              {formatPrice(unitPrice, currency)}
            </p>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
              Total: {formatPrice(lineTotal, currency)}
            </p>
          </div>

          <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50/80 p-0.5 sm:p-1">
              <button
                onClick={() => onUpdateQuantity(productId, quantity - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition-colors duration-200 hover:bg-white hover:text-slate-800"
                aria-label={`Decrease quantity for ${itemName}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[28px] text-center text-sm font-semibold text-slate-800">{quantity}</span>
              <button
                onClick={() => onUpdateQuantity(productId, quantity + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-700"
                aria-label={`Increase quantity for ${itemName}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-600">
              Qty {quantity}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
