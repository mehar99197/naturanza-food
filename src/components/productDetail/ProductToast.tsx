"use client";

import { Check } from "lucide-react";

/**
 * The confirmation strip that appears after add-to-cart, wishlist and share.
 *
 * The SPA rendered one of these at the bottom of the page, driven by state that
 * both the phone and desktop panels shared. Here each panel owns its own, and
 * only one panel is ever visible: the mobile tree is `md:hidden`, the desktop
 * tree `hidden md:block`. A fixed-position element inside a display:none
 * ancestor does not paint, so the visible panel's toast is the one that shows —
 * which is the toast the visitor's click raised.
 */
export interface ProductToastProps {
  message: string;
  visible: boolean;
}

export function ProductToast({ message, visible }: ProductToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 px-4 py-3 text-white shadow-xl md:left-auto md:right-6 md:w-auto md:translate-x-0">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
}
