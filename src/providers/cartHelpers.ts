/**
 * Types and the id resolver behind CartProvider, ported from
 * `frontend/src/context/CartContext.jsx`.
 *
 * Nothing here holds state or touches the browser.
 */

import type { Dispatch, SetStateAction } from "react";

/**
 * A cart line as `/cart` publishes it. Numeric columns arrive as DECIMAL
 * strings, which is why every read of them is coerced; the index signature
 * keeps any further columns the endpoint returns.
 */
export interface CartItem {
  product_id: string | number;
  name?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  stock_quantity?: number | string | null;
  discount_percentage?: number | string | null;
  final_price?: number | string | null;
  quantity?: number | string | null;
  subtotal?: number | string | null;
  /** Set on a line the UI added before the server confirmed it. */
  _optimistic?: boolean;
  [key: string]: unknown;
}

/** Whatever a product card hands to `addToCart` — three id spellings exist. */
export interface AddToCartProduct {
  product_id?: string | number | null;
  id?: string | number | null;
  productId?: string | number | null;
  name?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  image?: string | null;
  stock_quantity?: number | string | null;
  discount_percentage?: number | string | null;
}

export interface CartMutationResult {
  success: boolean;
  error?: string;
}

/** The `/cart` response body, as far as the provider reads it. */
export interface CartResponse {
  items?: CartItem[] | null;
}

export interface CartContextValue {
  items: CartItem[];
  addToCart: (
    product: AddToCartProduct | null | undefined,
    quantity?: number,
  ) => Promise<CartMutationResult>;
  removeFromCart: (productId: string | number) => Promise<void>;
  updateQuantity: (
    productId: string | number,
    quantity: number,
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
}

/** First of `product_id`, `id`, `productId` that is present. */
export const resolveProductId = (
  product: AddToCartProduct | null | undefined,
): string | number | null => {
  if (!product || typeof product !== "object") return null;
  return product.product_id ?? product.id ?? product.productId ?? null;
};
