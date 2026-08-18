"use client";

/**
 * Page heading, search field and the active-filter chips, ported from the
 * header block of frontend/src/pages/Shop.jsx.
 *
 * "use client": it owns the scroll-reveal observer and every chip is a button.
 * The `<h1>` inside is still server-rendered into the initial HTML — a Client
 * Component is pre-rendered on the server like any other, which is what keeps
 * the heading and the product grid visible to a crawler.
 */

import { useMemo } from "react";
import { Menu, X } from "lucide-react";

import { SearchBar } from "@/components/navigation/SearchBar";
import type { SearchBarProduct } from "@/components/navigation/searchBarTypes";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { formatCurrency } from "@/lib/utils";

import { ALL_CATEGORY_ID, type ShopCategoryOption, type ShopPriceRange, type ShopProduct } from "./types";

/**
 * The search field reads the raw REST shape — `image_url`, `category_name`,
 * `discount_percentage` — because that is what the SPA handed it. Server-mapped
 * products are camelCase, so they are translated back here rather than the
 * shared component being taught a second casing. Without this the suggestion
 * rows would lose their thumbnails and show "General" for every category.
 */
const toSuggestionProduct = (product: ShopProduct): SearchBarProduct => ({
  id: product.id,
  name: product.name,
  description: product.description,
  category_name: product.categoryName,
  image_url: product.imageUrl,
  price: product.price,
  discount_percentage: product.discountPercentage,
});

export interface ShopHeaderProps {
  products: readonly ShopProduct[];
  categories: readonly ShopCategoryOption[];
  selectedCategory: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  priceRange: ShopPriceRange;
  maxPrice: number;
  priceRangeCurrency: string;
  onCategoryChange: (category: string) => void;
  onResetPriceRange: () => void;
  onClearAllFilters: () => void;
  onOpenMobileDrawer: () => void;
}

export function ShopHeader({
  products,
  categories,
  selectedCategory,
  searchQuery,
  onSearchChange,
  priceRange,
  maxPrice,
  priceRangeCurrency,
  onCategoryChange,
  onResetPriceRange,
  onClearAllFilters,
  onOpenMobileDrawer,
}: ShopHeaderProps) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  // Memoised because the array's *identity* is a dependency of SearchBar's
  // suggestion effect. Re-mapping on every keystroke would rebuild the list on
  // each render and re-run that effect, defeating its 300 ms debounce.
  const suggestionProducts = useMemo(() => products.map(toSuggestionProduct), [products]);

  const hasActiveFilters =
    Boolean(searchQuery) || selectedCategory !== ALL_CATEGORY_ID || priceRange[1] !== maxPrice;

  return (
    <div
      className={`mb-5 sm:mb-6 reveal reveal-left ${headerVisible ? 'active' : ''}`}
      ref={headerRef}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="shop-mobile-title font-display text-2xl sm:text-3xl md:text-4xl leading-tight font-semibold text-[#2d3a2d] mb-1">
            Our Shop
          </h1>
          <p className="shop-mobile-subtitle text-[#6b7a6b] text-sm md:text-base font-normal leading-relaxed">
            Discover our collection of premium organic products
          </p>
        </div>

        {/* Mobile Filter Button */}
        <button
          onClick={onOpenMobileDrawer}
          className="shop-hit-target md:hidden self-start flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-[#3d7a3d] text-[#3d7a3d] rounded-xl hover:bg-[#3d7a3d] hover:text-white shadow-md"
        >
          <Menu className="w-5 h-5" />
          <span className="font-medium">Filters</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mb-3 sm:mb-4">
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          products={suggestionProducts}
          placeholder="Search products..."
        />
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="shop-active-filters flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto thin-scrollbar pb-1">
          <span className="text-sm text-[#6b7a6b] font-medium whitespace-nowrap">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3d7a3d] text-white text-sm rounded-full shadow-sm whitespace-nowrap">
              {searchQuery}
              <button
                onClick={() => onSearchChange("")}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {selectedCategory !== ALL_CATEGORY_ID && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full shadow-sm capitalize whitespace-nowrap">
              {/* Looked up by id only, so a `/shop/<slug>` URL leaves this chip
                  blank. Preserved from Shop.jsx; see the report. */}
              {categories.find((category) => category.id === selectedCategory)?.name}
              <button
                onClick={() => onCategoryChange(ALL_CATEGORY_ID)}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {priceRange[1] !== maxPrice && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white text-sm rounded-full shadow-sm whitespace-nowrap">
              Up to {formatCurrency(priceRange[1], priceRangeCurrency)}
              <button
                onClick={onResetPriceRange}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          <button
            onClick={onClearAllFilters}
            className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline px-2 whitespace-nowrap"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
