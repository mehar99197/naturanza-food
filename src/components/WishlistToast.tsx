"use client";

/**
 * Wishlist confirmation toast, ported from
 * frontend/src/components/WishlistToast.jsx.
 *
 * "use client" because it reads `showToast`/`toastMessage` straight off the
 * wishlist context, which only exists in the client tree. There is nothing else
 * to migrate — no routing, no state of its own; the provider owns the 3s timer
 * that clears the toast.
 */

import { Heart } from "lucide-react";

import { useWishlist } from "@/providers/WishlistProvider";

export function WishlistToast() {
  const { showToast, toastMessage } = useWishlist();

  if (!showToast) return null;

  return (
    <div className="wishlist-toast-mobile fixed bottom-4 right-4 sm:bottom-8 sm:right-8 left-4 sm:left-auto z-[100]">
      <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl flex items-center gap-3 w-full sm:w-auto sm:min-w-[300px] max-w-full">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Heart className="w-5 h-5 fill-current" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm break-words">{toastMessage}</p>
        </div>
      </div>
    </div>
  );
}
