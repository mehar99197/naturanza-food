"use client";

/**
 * The phone buy panel: quantity, then Add to Cart / Buy Now, then Wishlist /
 * Share.
 *
 * Everything stateful lives in `useProductActions`; this file is the markup for
 * the phone layout only. The desktop panel is a separate component because the
 * two trees differ in more than spacing — desktop puts wishlist and share as
 * icon-only squares beside Add to Cart, and Buy Now on its own full-width row.
 */

import { Heart, Share2, ShoppingCart } from "lucide-react";

import { ProductToast } from "./ProductToast";
import { QuantityStepper } from "./QuantityStepper";
import { useProductActions, type ProductActionsProduct } from "./useProductActions";

export function ProductActionsMobile({ product }: { product: ProductActionsProduct }) {
  const actions = useProductActions(product);

  return (
    <>
      <QuantityStepper
        quantity={actions.quantity}
        onIncrease={actions.increaseQuantity}
        onDecrease={actions.decreaseQuantity}
        isInStock={product.isInStock}
        variant="mobile"
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={actions.addToCart}
          disabled={!product.isInStock}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </button>

        <button
          type="button"
          onClick={actions.buyNow}
          disabled={!product.isInStock}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2f6f2f] px-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Buy Now
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={actions.toggleWishlist}
          disabled={actions.isWishlistUpdating}
          className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
            actions.isWishlisted
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-gray-200 bg-white text-gray-700"
          } ${actions.isWishlistUpdating ? "opacity-60" : ""}`}
        >
          <Heart className={`h-4 w-4 ${actions.isWishlisted ? "fill-current" : ""}`} />
          Wishlist
        </button>

        <button
          type="button"
          onClick={actions.share}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      <ProductToast message={actions.toastMessage} visible={actions.showToast} />
    </>
  );
}
