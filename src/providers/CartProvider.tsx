"use client";

/**
 * Server-backed cart, ported from `frontend/src/context/CartContext.jsx`.
 *
 * Two mechanisms carry the whole file and are reproduced verbatim:
 *
 *  - `requestGenerationRef` — every fetch stamps a generation number, and a
 *    response whose stamp is stale is dropped. It is what stops a cart fetched
 *    for the previous session landing after a logout.
 *  - `quantityMutationQueuesRef` — per-product promise chain, so two fast
 *    +1 clicks are applied in order instead of racing to overwrite each other.
 *
 * There is no localStorage here: the cart lives on the server, so an
 * unauthenticated visitor simply has an empty one. Nothing in this file touches
 * `window`, which makes it safe to render on the server as-is.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cartAPI } from "@/lib/api/cart";

import { apiErrorText, errorText } from "./apiErrors";
import { useAuth } from "./AuthProvider";
import {
  resolveProductId,
  type AddToCartProduct,
  type CartContextValue,
  type CartItem,
  type CartMutationResult,
  type CartResponse,
} from "./cartHelpers";

export type {
  AddToCartProduct,
  CartContextValue,
  CartItem,
  CartMutationResult,
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);
  const quantityMutationQueuesRef = useRef(new Map<string, Promise<void>>());

  const fetchCart = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current;
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await cartAPI.get<CartResponse>();
      if (requestGeneration !== requestGenerationRef.current) return;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if (requestGeneration !== requestGenerationRef.current) return;
      setError(errorText(err));
      setItems([]);
    } finally {
      if (requestGeneration === requestGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Fetch cart from API when authenticated
  useEffect(() => {
    // Don't fetch while auth is loading
    if (authLoading) {
      return;
    }

    if (isAuthenticated) {
      void fetchCart();
    } else {
      requestGenerationRef.current += 1;
      setItems([]);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchCart]);

  const addToCart = useCallback(
    async (
      product: AddToCartProduct | null | undefined,
      quantity: number = 1,
    ): Promise<CartMutationResult> => {
      if (!isAuthenticated) {
        const message = "Please login to add items to cart";
        setError(message);
        return { success: false, error: message };
      }

      const productId = resolveProductId(product);
      if (!productId) {
        const message = "Invalid product. Please refresh and try again.";
        setError(message);
        return { success: false, error: message };
      }

      const safeQuantity = Math.max(1, Number(quantity) || 1);
      const requestGeneration = requestGenerationRef.current;

      const price = Number(product?.price ?? 0);
      const discount = Number(product?.discount_percentage ?? 0);
      const finalPrice = price - (price * discount) / 100;

      let previousItems: CartItem[] | undefined;
      setItems((current) => {
        previousItems = current;
        const existingIndex = current.findIndex(
          (item) => String(item.product_id) === String(productId),
        );
        const existing = existingIndex === -1 ? undefined : current[existingIndex];
        if (existing) {
          const next = current.slice();
          const newQty = (Number(existing.quantity) || 0) + safeQuantity;
          const unit = Number(existing.final_price ?? existing.price ?? 0);
          next[existingIndex] = {
            ...existing,
            quantity: newQty,
            subtotal: (unit * newQty).toFixed(2),
          };
          return next;
        }
        return [
          ...current,
          {
            product_id: productId,
            name: product?.name,
            price,
            image_url: product?.image_url ?? product?.image ?? null,
            stock_quantity: product?.stock_quantity,
            discount_percentage: discount,
            final_price: finalPrice,
            quantity: safeQuantity,
            subtotal: (finalPrice * safeQuantity).toFixed(2),
            _optimistic: true,
          },
        ];
      });

      setError(null);

      try {
        await cartAPI.add(productId, safeQuantity);
        void fetchCart();
        return { success: true };
      } catch (err) {
        if (requestGeneration !== requestGenerationRef.current) {
          return {
            success: false,
            error: "Session changed while updating the cart",
          };
        }
        // PRESERVED AS FOUND: `previousItems` is assigned inside the state
        // updater, which React runs during the *next* render rather than
        // synchronously here. In practice that render always lands before this
        // await rejects, so the rollback works — but the source would set the
        // cart to `undefined` if it ever did not, and the cast keeps that
        // behaviour rather than quietly substituting an empty cart.
        setItems(previousItems as CartItem[]);
        const message = apiErrorText(err) || "Failed to add to cart";
        setError(message);
        return { success: false, error: message };
      }
    },
    [isAuthenticated, fetchCart],
  );

  const removeFromCart = useCallback(
    async (productId: string | number) => {
      if (!isAuthenticated) return;

      try {
        setError(null);
        await cartAPI.remove(productId);
        await fetchCart();
      } catch (err) {
        setError(apiErrorText(err) || "Failed to remove from cart");
      }
    },
    [isAuthenticated, fetchCart],
  );

  const updateQuantity = useCallback(
    async (productId: string | number, quantity: number) => {
      if (!isAuthenticated) return;
      const key = String(productId);
      const previous =
        quantityMutationQueuesRef.current.get(key) || Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        if (quantity <= 0) {
          await removeFromCart(productId);
          return;
        }

        try {
          setError(null);
          await cartAPI.update(productId, quantity);
          await fetchCart();
        } catch (err) {
          setError(apiErrorText(err) || "Failed to update quantity");
        }
      });
      const settled = operation.finally(() => {
        if (quantityMutationQueuesRef.current.get(key) === settled) {
          quantityMutationQueuesRef.current.delete(key);
        }
      });
      quantityMutationQueuesRef.current.set(key, settled);
      return settled;
    },
    [isAuthenticated, removeFromCart, fetchCart],
  );

  const clearCart = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setError(null);
      await cartAPI.clear();
      setItems([]);
    } catch (err) {
      setError(apiErrorText(err) || "Failed to clear cart");
    }
  }, [isAuthenticated]);

  const totalItems = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const totalPrice = items.reduce((sum, item) => {
    const unitPrice = Number(item.final_price ?? item.price ?? 0);
    const qty = Number(item.quantity) || 0;
    return sum + unitPrice * qty;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        loading,
        error,
        fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
