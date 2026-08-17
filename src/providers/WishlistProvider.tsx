"use client";

/**
 * Server-backed wishlist, ported from
 * `frontend/src/context/WishlistContext.jsx`.
 *
 * State, fetching and the live-refresh effects live here; the four optimistic
 * mutations are in `useWishlistMutations` purely for file size. The
 * live-refresh set — 15s poll, window focus, tab visibility and review
 * events — is what keeps a second tab and the profile page in step, and its
 * interval, listeners and dependency arrays are unchanged.
 *
 * No localStorage: the wishlist is server state. `window`/`document` are
 * touched only inside effects and handlers, which never run during server
 * rendering, so the provider renders safely on the server with an empty list.
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

import { wishlistAPI } from "@/lib/api/wishlist";

import { apiErrorText, errorText } from "./apiErrors";
import { useAuth } from "./AuthProvider";
import { REVIEW_EVENTS, reviewEvents } from "@/lib/reviewEvents";
import {
  useWishlistMutations,
  type WishlistFetchOptions,
  type WishlistMutations,
} from "./useWishlistMutations";
import {
  extractItemProductId,
  normalizeProductId,
  WISHLIST_UPDATED_EVENT,
  type ProductIdInput,
  type WishlistItem,
  type WishlistMutationResult,
  type WishlistProduct,
} from "./wishlistHelpers";

export type {
  WishlistFetchOptions,
  WishlistItem,
  WishlistMutationResult,
  WishlistProduct,
};

/** How often a visible tab re-reads the wishlist. */
const LIVE_REFRESH_INTERVAL_MS = 15000;

/** How long a wishlist toast stays on screen. */
const TOAST_DURATION_MS = 3000;

interface WishlistResponse {
  items?: WishlistItem[] | null;
}

export interface WishlistContextValue extends WishlistMutations {
  items: WishlistItem[];
  totalItems: number;
  isInWishlist: (productId: ProductIdInput) => boolean;
  isUpdating: (productId: ProductIdInput) => boolean;
  refreshWishlist: (options?: WishlistFetchOptions) => Promise<WishlistItem[]>;
  showToast: boolean;
  toastMessage: string;
  loading: boolean;
  error: string | null;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const toastTimeoutRef = useRef<number | null>(null);
  const requestGenerationRef = useRef(0);

  const showTransientToast = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false);
    }, TOAST_DURATION_MS);
  }, []);

  const fetchWishlist = useCallback(
    async ({ silent = false }: WishlistFetchOptions = {}): Promise<
      WishlistItem[]
    > => {
      const requestGeneration = ++requestGenerationRef.current;
      if (!isAuthenticated) {
        setItems([]);
        return [];
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        const data = await wishlistAPI.get<WishlistResponse>();
        if (requestGeneration !== requestGenerationRef.current) return [];
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        setItems(nextItems);
        return nextItems;
      } catch (err) {
        if (requestGeneration !== requestGenerationRef.current) return [];
        const message =
          apiErrorText(err) || errorText(err) || "Failed to load wishlist";
        setError(message);
        setItems([]);
        return [];
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    // Don't fetch while auth is loading
    if (authLoading) {
      return;
    }

    if (isAuthenticated) {
      void fetchWishlist();
      return;
    }

    setItems([]);
    setError(null);
    setUpdatingIds(new Set());
    requestGenerationRef.current += 1;
  }, [isAuthenticated, authLoading, fetchWishlist]);

  useEffect(() => {
    const handleWishlistUpdated = () => {
      if (!isAuthenticated) {
        return;
      }

      void fetchWishlist({ silent: true });
    };

    window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdated);

    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdated);
    };
  }, [fetchWishlist, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const refreshLiveWishlist = () => {
      if (document.visibilityState === "visible") {
        void fetchWishlist({ silent: true });
      }
    };

    const intervalId = window.setInterval(
      refreshLiveWishlist,
      LIVE_REFRESH_INTERVAL_MS,
    );
    const handleWindowFocus = () => refreshLiveWishlist();
    const handleVisibilityChange = () => refreshLiveWishlist();
    const unsubscribeSubmitted = reviewEvents.on(
      REVIEW_EVENTS.REVIEW_SUBMITTED,
      refreshLiveWishlist,
    );
    const unsubscribeUpdated = reviewEvents.on(
      REVIEW_EVENTS.REVIEW_UPDATED,
      refreshLiveWishlist,
    );
    const unsubscribeDeleted = reviewEvents.on(
      REVIEW_EVENTS.REVIEW_DELETED,
      refreshLiveWishlist,
    );

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeSubmitted();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [fetchWishlist, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const isInWishlist = useCallback(
    (productId: ProductIdInput) => {
      const normalizedProductId = normalizeProductId(productId);
      if (!normalizedProductId) {
        return false;
      }

      return items.some(
        (item) => extractItemProductId(item) === normalizedProductId,
      );
    },
    [items],
  );

  const isUpdating = useCallback(
    (productId: ProductIdInput) =>
      updatingIds.has(normalizeProductId(productId)),
    [updatingIds],
  );

  const mutations = useWishlistMutations({
    isAuthenticated,
    items,
    setItems,
    setError,
    updatingIds,
    setUpdatingIds,
    showTransientToast,
    isInWishlist,
    fetchWishlist,
  });

  const value: WishlistContextValue = {
    items,
    totalItems: items.length,
    isInWishlist,
    isUpdating,
    ...mutations,
    refreshWishlist: fetchWishlist,
    showToast,
    toastMessage,
    loading,
    error,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
