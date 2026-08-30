"use client";

/**
 * Every interaction the buy panel owns: quantity, add-to-cart, buy-now,
 * wishlist, share, and the confirmation toast. Ported from the handlers in
 * frontend/src/pages/ProductDetail.jsx.
 *
 * The provider calls are unchanged — `addToCart(product, quantity)` and
 * `toggleWishlist(product)`, with the same success/error branches driving the
 * same toast copy.
 *
 * ROUTING. `navigate('/login', { state: { from: { pathname } } })` has no App
 * Router equivalent, so `loginUrlFor` encodes the same destination as
 * `?returnTo=%2Fproduct%2F<id>` — which also survives a refresh, where router
 * state did not.
 *
 * WHAT IS SENT TO THE CART. The SPA handed `addToCart` the raw API row, so the
 * optimistic line it draws before the server answers found `discount_percentage`
 * and `image_url` on it. A Server Component holds the mapped domain type
 * instead, so the payload below restates those two fields in the casing
 * CartProvider reads. Without that the optimistic row would show the
 * undiscounted price for a moment before `fetchCart()` corrected it.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { loginUrlFor } from "@/lib/returnTo";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import type { AddToCartProduct } from "@/providers/cartHelpers";
import { useWishlist } from "@/providers/WishlistProvider";

/** The serialisable slice of a product this panel needs across the boundary. */
export interface ProductActionsProduct {
  id: number;
  name: string;
  /** Shared as the `text` of a native share sheet, exactly as the SPA did. */
  description: string | null;
  price: number;
  discountPercentage: number;
  imageUrl: string | null;
  isInStock: boolean;
}

export interface ProductActions {
  quantity: number;
  increaseQuantity: () => void;
  decreaseQuantity: () => void;
  addToCart: () => Promise<void>;
  buyNow: () => Promise<void>;
  toggleWishlist: () => Promise<void>;
  share: () => Promise<void>;
  isWishlisted: boolean;
  isWishlistUpdating: boolean;
  toastMessage: string;
  showToast: boolean;
}

/**
 * Quantity floor of 1.
 *
 * The SPA also took a `maxAllowedQty` ceiling, but it was only ever non-null on
 * the branch where the payload carried no `is_in_stock` boolean — which the API
 * always sends. See ProductStockBadge for the full note. Nothing is lost by
 * dropping a cap that was always null, and reinstating one would mean
 * publishing exact stock levels.
 */
const clampQuantity = (value: number): number => Math.max(1, Number(value) || 1);

export const useProductActions = (product: ProductActionsProduct): ProductActions => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { isInWishlist, isUpdating, toggleWishlist } = useWishlist();

  const [quantity, setQuantity] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isWishlisted = isInWishlist(product.id);
  const isWishlistUpdating = isUpdating(product.id);

  // PRESERVED AS FOUND: the timer is neither stored nor cleared, so a second
  // toast raised within two seconds of the first is hidden early by the first
  // one's timeout. The original behaves identically.
  const showFeedback = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2000);
  };

  const goToLogin = () => {
    router.push(loginUrlFor(`/product/${product.id}`));
  };

  const cartPayload: AddToCartProduct = {
    id: product.id,
    product_id: product.id,
    name: product.name,
    price: product.price,
    discount_percentage: product.discountPercentage,
    image_url: product.imageUrl,
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    const result = await addToCart(cartPayload, clampQuantity(quantity));

    if (result?.success) {
      showFeedback("Added to cart!");
    } else {
      showFeedback(result?.error || "Unable to add item to cart.");
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    const result = await addToCart(cartPayload, clampQuantity(quantity));

    if (result?.success) {
      router.push("/checkout");
      return;
    }

    showFeedback(result?.error || "Unable to continue to checkout.");
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    if (isWishlistUpdating) {
      return;
    }

    const wasWishlisted = isWishlisted;
    // Both casings again: the optimistic wishlist row is rendered by
    // ProductCard, which reads whichever spelling it finds.
    const result = await toggleWishlist({
      ...product,
      id: product.id,
      product_id: product.id,
      image_url: product.imageUrl,
      discount_percentage: product.discountPercentage,
    });

    if (result?.success) {
      showFeedback(wasWishlisted ? "Removed from wishlist" : "Added to wishlist");
    } else if (result?.message) {
      showFeedback(result.message);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: product.name,
          ...(product.description ? { text: product.description } : {}),
          url: shareUrl,
        });
        return;
      } catch {
        /* ignored: not fatal to this flow */
      }
    }

    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(shareUrl);
        showFeedback("Link copied to clipboard!");
      }
    } catch {
      showFeedback("Unable to share link right now.");
    }
  };

  return {
    quantity,
    increaseQuantity: () => setQuantity((prev) => clampQuantity(prev + 1)),
    decreaseQuantity: () => setQuantity((prev) => clampQuantity(prev - 1)),
    addToCart: handleAddToCart,
    buyNow: handleBuyNow,
    toggleWishlist: handleWishlistToggle,
    share: handleShare,
    isWishlisted,
    isWishlistUpdating,
    toastMessage,
    showToast,
  };
};
