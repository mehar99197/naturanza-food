"use client";

/**
 * Every piece of shop state that Shop.jsx kept in the page component, in one
 * hook.
 *
 * WHAT LIVES IN THE URL AND WHAT DOES NOT — unchanged from the SPA, and worth
 * stating because it decided the whole shape of this port. Only the *category*
 * is addressable: `/shop/<slug>` from the path, `?category=<id>` from a sidebar
 * click. Sort, view mode, price range and the search box are component state
 * and were never reflected in the URL. So the server renders the catalog and
 * the default view; this hook narrows it in the browser, exactly as before.
 *
 * URL writes go through `window.history.replaceState`, which App Router
 * integrates with `usePathname`/`useSearchParams`. That is the faithful
 * equivalent of react-router's `setSearchParams(next, { replace: true })`:
 * the address bar updates, no history entry is pushed, and — critically — no
 * server round trip happens, so a category click stays as instant as it was.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { convertFromPkr, hasExchangeRate } from "@/lib/exchangeRates";
import { useSettings } from "@/providers/SettingsProvider";

import { buildCategoryOptions } from "./categoryOptions";
import {
  countByCategory,
  filterByCategory,
  filterBySearch,
  resolveCategoryName,
  sortProducts,
} from "./filtering";
import {
  ALL_CATEGORY_ID,
  DEFAULT_SORT_KEY,
  type ShopCategoryCounts,
  type ShopCategoryData,
  type ShopCategoryOption,
  type ShopPriceRange,
  type ShopProduct,
  type ShopSortKey,
  type ShopViewMode,
} from "./types";

/** Top of the price slider in rupees, before any currency conversion. */
const BASE_MAX_PRICE = 10000;

export interface UseShopFiltersOptions {
  products: readonly ShopProduct[];
  categories: readonly ShopCategoryData[];
  /**
   * The `[category]` route segment, when the page is `/shop/<slug>`.
   *
   * ⚠ It wins over `?category=` unconditionally, which is what makes the
   * sidebar inert on a category URL — see the report. Preserved from Shop.jsx.
   */
  pathCategory?: string | undefined;
}

export interface UseShopFiltersResult {
  categories: ShopCategoryOption[];
  categoryCounts: ShopCategoryCounts;
  selectedCategory: string;
  selectedCategoryName: string;
  filteredProducts: ShopProduct[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortBy: ShopSortKey;
  setSortBy: (value: ShopSortKey) => void;
  viewMode: ShopViewMode;
  setViewMode: (value: ShopViewMode) => void;
  priceRange: ShopPriceRange;
  setMaxSelectedPrice: (value: number) => void;
  resetPriceRange: () => void;
  maxPrice: number;
  priceRangeCurrency: string;
  onCategoryChange: (category: string) => void;
  clearAllFilters: () => void;
}

export function useShopFilters({
  products,
  categories,
  pathCategory,
}: UseShopFiltersOptions): UseShopFiltersResult {
  const { settings, exchangeRates } = useSettings();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ShopViewMode>("grid");
  const [sortBy, setSortBy] = useState<ShopSortKey>(DEFAULT_SORT_KEY);
  const [searchQuery, setSearchQuery] = useState("");

  const currencyCode = String(settings.currency || "PKR").toUpperCase();
  const hasRate = hasExchangeRate(currencyCode);
  const computedMaxPrice = hasRate
    ? Math.round(convertFromPkr(BASE_MAX_PRICE, currencyCode) || BASE_MAX_PRICE)
    : BASE_MAX_PRICE;
  const maxPrice = Math.max(1, computedMaxPrice);
  const priceRangeCurrency = hasRate ? currencyCode : "PKR";

  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);
  const currencyRef = useRef(currencyCode);

  /**
   * The selected category, resolved exactly as Shop.jsx resolved it:
   * `pathCategory || ?category= || "all"`.
   *
   * The mirrored state is belt and braces. `history.replaceState` is documented
   * to feed back into `useSearchParams`, but the click must repaint the grid
   * whether or not it does — so the click updates state directly and the URL is
   * re-read only when it changes underneath us (back/forward, or a link into
   * this page from elsewhere in the app). Adjusting state during render like
   * this is React's own "derive state from props" pattern; it costs one extra
   * render pass and no effect.
   */
  const urlCategory = searchParams.get("category") ?? "";
  const [selectedQueryCategory, setSelectedQueryCategory] = useState(urlCategory);
  const [observedUrlCategory, setObservedUrlCategory] = useState(urlCategory);

  if (observedUrlCategory !== urlCategory) {
    setObservedUrlCategory(urlCategory);
    setSelectedQueryCategory(urlCategory);
  }

  const selectedCategory =
    pathCategory || selectedQueryCategory || ALL_CATEGORY_ID;

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  );

  /**
   * Re-scale the slider when the display currency changes, and clamp it if the
   * new ceiling is lower than the current selection. The ref is what tells a
   * currency switch apart from a re-render, so a user's chosen range survives
   * an exchange-rate refresh that leaves the currency alone.
   */
  useEffect(() => {
    if (currencyRef.current !== currencyCode) {
      setPriceRange([0, maxPrice]);
      currencyRef.current = currencyCode;
      return;
    }

    if (priceRange[1] > maxPrice) {
      setPriceRange([priceRange[0], maxPrice]);
    }
  }, [currencyCode, maxPrice, priceRange]);

  /**
   * `/shop?search=…` is how the header's search box hands a query over. Adopt
   * it into local state, then strip it from the address bar so a reload or a
   * shared link does not re-apply a search the user has since cleared.
   */
  useEffect(() => {
    const searchParam = searchParams.get("search");
    if (!searchParam) return;

    setSearchQuery(searchParam);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("search");
    const query = nextParams.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  const onCategoryChange = useCallback(
    (category: string) => {
      const isAll = category === ALL_CATEGORY_ID;
      // Only the selection is set here, never `observedUrlCategory`: leaving
      // that alone is what makes the render-time sync a no-op if the router
      // does pick the new URL up, and harmless if it does not.
      setSelectedQueryCategory(isAll ? "" : category);

      const nextParams = new URLSearchParams(searchParams.toString());
      if (isAll) {
        nextParams.delete("category");
      } else {
        nextParams.set("category", category);
      }
      const query = nextParams.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname, searchParams],
  );

  const setMaxSelectedPrice = useCallback((value: number) => {
    setPriceRange((current) => [current[0], value]);
  }, []);

  const resetPriceRange = useCallback(() => {
    setPriceRange([0, maxPrice]);
  }, [maxPrice]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    onCategoryChange(ALL_CATEGORY_ID);
    setPriceRange([0, maxPrice]);
  }, [maxPrice, onCategoryChange]);

  const categoryCounts = useMemo(
    () => countByCategory(products, categoryOptions),
    [products, categoryOptions],
  );

  const selectedCategoryName = useMemo(
    () => resolveCategoryName(categoryOptions, selectedCategory),
    [categoryOptions, selectedCategory],
  );

  const filteredProducts = useMemo(() => {
    const bySearch = filterBySearch(products, searchQuery);
    const byCategory = filterByCategory(bySearch, selectedCategory, categoryOptions);

    // Prices are stored in rupees and displayed converted, so the slider —
    // which is labelled in the display currency — has to compare converted
    // values. An unconvertible amount falls back to the rupee figure, exactly
    // as the SPA did.
    const byPrice = byCategory.filter((product) => {
      const basePrice = Number(product.price);
      const convertedPrice = hasRate
        ? convertFromPkr(basePrice, currencyCode)
        : basePrice;
      const priceValue = Number.isFinite(convertedPrice)
        ? Number(convertedPrice)
        : basePrice;
      return priceValue >= priceRange[0] && priceValue <= priceRange[1];
    });

    return sortProducts(byPrice, sortBy);
  }, [
    products,
    searchQuery,
    selectedCategory,
    categoryOptions,
    priceRange,
    sortBy,
    hasRate,
    currencyCode,
    // A live rate refresh changes every converted price, so it must re-run the
    // price filter even though no filter input moved.
    exchangeRates.updatedAt,
  ]);

  return {
    categories: categoryOptions,
    categoryCounts,
    selectedCategory,
    selectedCategoryName,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    priceRange,
    setMaxSelectedPrice,
    resetPriceRange,
    maxPrice,
    priceRangeCurrency,
    onCategoryChange,
    clearAllFilters,
  };
}
