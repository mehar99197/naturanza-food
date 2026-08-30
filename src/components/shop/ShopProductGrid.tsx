"use client";

/**
 * The results area: the product grid, the catalog-error panel and the
 * no-results panel, ported from the last block of frontend/src/pages/Shop.jsx.
 *
 * The SPA had a fourth branch — the skeleton grid, shown while the browser
 * fetched the catalog. There is nothing to wait for here, because the products
 * arrive with the HTML, so that markup moved to the route's loading.tsx where
 * it is still shown during navigation. It is not reproduced as a dead branch.
 */

import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { ProductCard } from "@/components/product/ProductCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

import type { ShopProduct, ShopViewMode } from "./types";

/**
 * The grid's column rules. loading.tsx repeats the grid-mode string rather than
 * importing this: a value exported from a `"use client"` module reaches a
 * Server Component only as a reference it cannot call.
 */
const shopGridClassName = (viewMode: ShopViewMode): string =>
  `shop-grid-compact grid gap-3 sm:gap-5 md:gap-5 lg:gap-6 ${
    viewMode === "grid"
      ? "grid-cols-2 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
      : "grid-cols-1"
  }`;

export interface ShopProductGridProps {
  products: readonly ShopProduct[];
  viewMode: ShopViewMode;
  searchQuery: string;
  onClearAllFilters: () => void;
  /** Message from a failed catalog read, rendered in place of the grid. */
  error: string | null;
}

export function ShopProductGrid({
  products,
  viewMode,
  searchQuery,
  onClearAllFilters,
  error,
}: ShopProductGridProps) {
  const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.12 });
  const router = useRouter();

  return (
    <div
      className={`reveal reveal-right ${gridVisible ? 'active' : ''}`}
      ref={gridRef}
    >
      {error ? (
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          <p>{error}</p>
          {/* The SPA re-ran its own fetch here. The equivalent now is asking the
              server for a fresh render of this route. */}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white"
          >
            Try again
          </button>
        </div>
      ) : products.length > 0 ? (
        <div className={shopGridClassName(viewMode)}>
          {products.map((product) => (
            <div
              key={product.id}
              className={
                viewMode === "grid"
                  ? "h-full min-w-0 w-full max-w-[15.75rem] mx-auto"
                  : "h-full min-w-0"
              }
            >
              <ProductCard product={product} viewMode={viewMode} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16 bg-white rounded-xl shadow-sm">
          <div className="max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-[#2d3a2d] text-lg font-semibold mb-2">
              No products found
            </p>
            <p className="text-[#6b7a6b] mb-6">
              {searchQuery
                ? `No results for"${searchQuery}". Try adjusting your search or filters.`
                : "Try adjusting your filters to see more products."}
            </p>
            <button
              onClick={onClearAllFilters}
              className="px-6 py-3 bg-[#3d7a3d] text-white rounded-xl font-medium hover:bg-[#2d5a2d] shadow-md"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
