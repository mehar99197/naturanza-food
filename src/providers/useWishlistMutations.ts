/**
 * The four wishlist mutations, split out of WishlistProvider for size.
 *
 * Each one is optimistic: state moves first, the request follows, and a failure
 * rolls the item back *and* triggers a re-fetch so the list matches the server
 * rather than the guess. `updatingIds` is what stops a double-click firing two
 * adds for the same product. Every `useCallback` dependency list is reproduced
 * exactly as the source had it — `addToWishlist` and `removeFromWishlist`
 * genuinely depend on `updatingIds`/`items`, so they are rebuilt whenever those
 * change, and shortening the lists would make them act on a stale snapshot.
 */

import { useCallback, type Dispatch, type SetStateAction } from "react";

import { wishlistAPI } from "@/lib/api/wishlist";

import { apiErrorText } from "./apiErrors";
import {
  emitWishlistUpdated,
  extractItemProductId,
  normalizeProductId,
  type ProductIdInput,
  type WishlistItem,
  type WishlistMutationResult,
  type WishlistProduct,
} from "./wishlistHelpers";

export interface WishlistFetchOptions {
  /** Skips the loading flag, for background refreshes. */
  silent?: boolean;
}

export interface WishlistMutationDeps {
  isAuthenticated: boolean;
  items: WishlistItem[];
  setItems: Dispatch<SetStateAction<WishlistItem[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  updatingIds: Set<string>;
  setUpdatingIds: Dispatch<SetStateAction<Set<string>>>;
  showTransientToast: (message: string) => void;
  isInWishlist: (productId: ProductIdInput) => boolean;
  fetchWishlist: (options?: WishlistFetchOptions) => Promise<WishlistItem[]>;
}

export interface WishlistMutations {
  addToWishlist: (
    product: WishlistProduct | null | undefined,
  ) => Promise<WishlistMutationResult>;
  removeFromWishlist: (
    productId: ProductIdInput,
  ) => Promise<WishlistMutationResult>;
  toggleWishlist: (
    product: WishlistProduct | null | undefined,
  ) => Promise<WishlistMutationResult>;
  clearWishlist: () => Promise<WishlistMutationResult>;
}

export const useWishlistMutations = ({
  isAuthenticated,
  items,
  setItems,
  setError,
  updatingIds,
  setUpdatingIds,
  showTransientToast,
  isInWishlist,
  fetchWishlist,
}: WishlistMutationDeps): WishlistMutations => {
  const addToWishlist = useCallback(
    async (
      product: WishlistProduct | null | undefined,
    ): Promise<WishlistMutationResult> => {
      if (!isAuthenticated) {
        showTransientToast("Please login to add items to wishlist");
        return { success: false, requiresAuth: true };
      }

      const normalizedProductId = normalizeProductId(
        product?.id ?? product?.product_id,
      );

      if (!normalizedProductId) {
        showTransientToast("Unable to identify this product");
        return { success: false };
      }

      if (
        updatingIds.has(normalizedProductId) ||
        isInWishlist(normalizedProductId)
      ) {
        return { success: true };
      }

      const optimisticItem: WishlistItem = {
        ...product,
        id: product?.id ?? normalizedProductId,
        product_id: product?.product_id ?? product?.id ?? normalizedProductId,
      };

      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.add(normalizedProductId);
        return next;
      });

      setItems((prev) => [optimisticItem, ...prev]);

      try {
        setError(null);
        await wishlistAPI.add(normalizedProductId);
        showTransientToast(`${product?.name || "Product"} added to wishlist`);
        emitWishlistUpdated();
        return { success: true };
      } catch (err) {
        const message = apiErrorText(err) || "Failed to add to wishlist";
        setError(message);
        showTransientToast(message);
        setItems((prev) =>
          prev.filter(
            (item) => extractItemProductId(item) !== normalizedProductId,
          ),
        );
        void fetchWishlist();
        return { success: false, message };
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(normalizedProductId);
          return next;
        });
      }
    },
    [
      fetchWishlist,
      isAuthenticated,
      isInWishlist,
      showTransientToast,
      updatingIds,
      setError,
      setItems,
      setUpdatingIds,
    ],
  );

  const removeFromWishlist = useCallback(
    async (productId: ProductIdInput): Promise<WishlistMutationResult> => {
      if (!isAuthenticated) {
        return { success: false, requiresAuth: true };
      }

      const normalizedProductId = normalizeProductId(productId);
      if (!normalizedProductId || updatingIds.has(normalizedProductId)) {
        return { success: false };
      }

      const product = items.find(
        (item) => extractItemProductId(item) === normalizedProductId,
      );

      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.add(normalizedProductId);
        return next;
      });

      setItems((prev) =>
        prev.filter(
          (item) => extractItemProductId(item) !== normalizedProductId,
        ),
      );

      try {
        setError(null);
        // `remove` hits `DELETE /wishlist/:product_id`, which the doc comment on
        // wishlistAPI describes as taking a wishlist row id. It does not:
        // backend/routes/wishlist.js routes both `/:product_id` and
        // `/remove/:productId` to the same handler, both keyed on product id.
        // The source called `remove`, so this does too — it is correct.
        await wishlistAPI.remove(normalizedProductId);
        showTransientToast(
          `${product?.name || "Product"} removed from wishlist`,
        );
        emitWishlistUpdated();
        return { success: true };
      } catch (err) {
        const message = apiErrorText(err) || "Failed to remove from wishlist";
        setError(message);
        showTransientToast(message);
        void fetchWishlist();
        return { success: false, message };
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(normalizedProductId);
          return next;
        });
      }
    },
    [
      fetchWishlist,
      isAuthenticated,
      items,
      showTransientToast,
      updatingIds,
      setError,
      setItems,
      setUpdatingIds,
    ],
  );

  const toggleWishlist = useCallback(
    async (
      product: WishlistProduct | null | undefined,
    ): Promise<WishlistMutationResult> => {
      const normalizedProductId = normalizeProductId(
        product?.id ?? product?.product_id,
      );

      if (!normalizedProductId) {
        return { success: false };
      }

      if (isInWishlist(normalizedProductId)) {
        return removeFromWishlist(normalizedProductId);
      }

      return addToWishlist(product);
    },
    [addToWishlist, isInWishlist, removeFromWishlist],
  );

  const clearWishlist = useCallback(async (): Promise<WishlistMutationResult> => {
    if (!isAuthenticated) {
      return { success: false, requiresAuth: true };
    }

    const previousItems = items;
    setItems([]);

    try {
      setError(null);
      await wishlistAPI.clear();
      showTransientToast("Wishlist cleared");
      emitWishlistUpdated();
      return { success: true };
    } catch (err) {
      const message = apiErrorText(err) || "Failed to clear wishlist";
      setError(message);
      showTransientToast(message);
      setItems(previousItems);
      return { success: false, message };
    }
  }, [isAuthenticated, items, showTransientToast, setError, setItems]);

  return {
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
  };
};
