"use client";

/**
 * The shop's interactive shell: sidebar, header, toolbar and grid, wired to the
 * filter state in useShopFilters.
 *
 * This is a Client Component, but it is *not* a client-only page. It receives
 * the catalog as a prop from the Server Component above it and Next pre-renders
 * it on the server, so the first HTML response already contains every product
 * card, the `<h1>`, and the links to each product page. The SPA sent an empty
 * shell and fetched the catalog from the browser; a crawler saw nothing and the
 * LCP waited on a round trip. That is the whole point of the migration for this
 * route.
 *
 * The `<main>` here duplicates the one in the storefront layout, which is what
 * frontend/src/App.jsx did too (`<main id="main-content">` wrapping a page that
 * opens with its own `<main>`). Kept so the class names that style this page —
 * `shop-mobile-shell` in particular, which restyles `.container-custom` beneath
 * it — land on the same element as before.
 */

import { useEffect, useState } from "react";

import { ShopHeader } from "./ShopHeader";
import { ShopProductGrid } from "./ShopProductGrid";
import { ShopSidebar } from "./ShopSidebar";
import { ShopToolbar } from "./ShopToolbar";
import { useShopFilters } from "./useShopFilters";
import type { ShopCategoryData, ShopProduct } from "./types";

export interface ShopBrowserProps {
  products: readonly ShopProduct[];
  categories: readonly ShopCategoryData[];
  /** Present on `/shop/[category]`; absent on `/shop`. */
  pathCategory?: string | undefined;
  /** Message from a failed catalog read, shown in place of the grid. */
  productsError?: string | null;
}

export function ShopBrowser({
  products,
  categories,
  pathCategory,
  productsError = null,
}: ShopBrowserProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const {
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
  } = useShopFilters({ products, categories, pathCategory });

  // Lock the page behind the mobile filter drawer, restoring whatever overflow
  // the body had rather than assuming it was "".
  useEffect(() => {
    if (!mobileDrawerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileDrawerOpen]);

  return (
    <main className="shop-mobile-shell pt-24 pb-12 sm:pb-16 min-h-screen bg-green-50 overflow-x-hidden">
      {/* Mobile Overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      <div className="flex gap-0 md:gap-6 lg:gap-8">
        {/* Collapsible Sidebar */}
        <ShopSidebar
          categories={categoryOptions}
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileDrawerOpen={mobileDrawerOpen}
          onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
          priceRange={priceRange}
          maxPrice={maxPrice}
          priceRangeCurrency={priceRangeCurrency}
          onMaxPriceChange={setMaxSelectedPrice}
        />

        {/* Main Content. The original varied this class on `sidebarCollapsed`,
            but both branches emitted `lg:ml-0`, so the output is unchanged. */}
        <div className="flex-1 min-w-0 lg:ml-0">
          <div className="container-custom">
            <ShopHeader
              products={products}
              categories={categoryOptions}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              priceRange={priceRange}
              maxPrice={maxPrice}
              priceRangeCurrency={priceRangeCurrency}
              onCategoryChange={onCategoryChange}
              onResetPriceRange={resetPriceRange}
              onClearAllFilters={clearAllFilters}
              onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
            />

            <ShopToolbar
              resultCount={filteredProducts.length}
              categoryName={selectedCategoryName}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            <ShopProductGrid
              products={filteredProducts}
              viewMode={viewMode}
              searchQuery={searchQuery}
              onClearAllFilters={clearAllFilters}
              error={productsError}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
