"use client";

import { Minus, Plus } from "lucide-react";

import type { ProductDetailVariant } from "./types";

/**
 * The "Quantity  − n +" row.
 *
 * The increase button's disabled rule in the SPA was
 * `!hasStock || (maxAllowedQty !== null && quantity >= maxAllowedQty)`. The
 * second clause never fired — see ProductStockBadge for why `maxAllowedQty` was
 * always null — so only the stock check survives.
 */
export interface QuantityStepperProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  isInStock: boolean;
  variant: ProductDetailVariant;
}

export function QuantityStepper({
  quantity,
  onIncrease,
  onDecrease,
  isInStock,
  variant,
}: QuantityStepperProps) {
  const isMobile = variant === "mobile";
  const buttonSize = isMobile ? "h-7 w-7" : "h-8 w-8";
  const iconSize = isMobile ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={
        isMobile
          ? "mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
          : "mt-5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5"
      }
    >
      <span className="text-sm font-semibold text-gray-700">Quantity</span>
      <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!isInStock || quantity <= 1}
          className={`flex ${buttonSize} items-center justify-center rounded-full text-gray-700 disabled:opacity-40`}
          aria-label="Decrease quantity"
        >
          <Minus className={iconSize} />
        </button>
        <span
          className={
            isMobile
              ? "min-w-[30px] text-center text-sm font-bold text-gray-900"
              : "min-w-[36px] text-center text-base font-bold text-gray-900"
          }
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={!isInStock}
          className={`flex ${buttonSize} items-center justify-center rounded-full text-gray-700 disabled:opacity-40`}
          aria-label="Increase quantity"
        >
          <Plus className={iconSize} />
        </button>
      </div>
    </div>
  );
}
