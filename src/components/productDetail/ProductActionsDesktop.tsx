"use client";

/**
 * The desktop buy panel: quantity, then a three-column row of Add to Cart plus
 * icon-only wishlist and share squares, then a full-width Buy Now.
 *
 * Shares every handler with the phone panel through `useProductActions`; only
 * the markup differs. See ProductActionsMobile for the split's rationale.
 */

import { Heart, Share2, ShoppingCart } from "lucide-react";

import { ProductToast } from "./ProductToast";
import { QuantityStepper } from "./QuantityStepper";
import { useProductActions, type ProductActionsProduct } from "./useProductActions";

export function ProductActionsDesktop({ product }: { product: ProductActionsProduct }) {
  const actions = useProductActions(product);

  return (
    <>
      <QuantityStepper
        quantity={actions.quantity}
        onIncrease={actions.increaseQuantity}
        onDecrease={actions.decreaseQuantity}
        isInStock={product.isInStock}
        variant="desktop"
      />

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2.5">
          <button
            type="button"
            onClick={actions.addToCart}
            disabled={!product.isInStock}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </button>

          <button
            type="button"
            onClick={actions.toggleWishlist}
            disabled={actions.isWishlistUpdating}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
              actions.isWishlisted
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-gray-200 bg-white text-gray-700"
            } ${actions.isWishlistUpdating ? "opacity-60" : ""}`}
            aria-label="Toggle wishlist"
          >
            <Heart className={`h-5 w-5 ${actions.isWishlisted ? "fill-current" : ""}`} />
          </button>

          <button
            type="button"
            onClick={actions.share}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
            aria-label="Share product"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={actions.buyNow}
          disabled={!product.isInStock}
          className="inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-[#2f6f2f] px-4 text-base font-bold text-white disabled:opacity-50"
        >
          Buy Now
        </button>
      </div>

      <ProductToast message={actions.toastMessage} visible={actions.showToast} />
    </>
  );
}
