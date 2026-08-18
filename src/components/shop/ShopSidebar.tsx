"use client";

/**
 * The shop's filter rail — categories and the price slider — ported from the
 * `<aside>` in frontend/src/pages/Shop.jsx.
 *
 * "use client": every control here is a click handler, and the collapsed state
 * changes what is rendered rather than only how it looks.
 *
 * The category rows stay `<button>`s rather than becoming `<Link>`s. They are
 * not navigation: the SPA rewrote `?category=` in place and re-filtered an
 * array it already had, and turning them into links would trade an instant
 * filter for a server round trip. The crawlable route to a category is
 * `/shop/<slug>`, which the footer and the homepage already link.
 */

import { ChevronLeft, ChevronRight, DollarSign, X } from "lucide-react";

import { formatCurrency } from "@/lib/utils";

import type { ShopCategoryCounts, ShopCategoryOption, ShopPriceRange } from "./types";

export interface ShopSidebarProps {
  categories: readonly ShopCategoryOption[];
  categoryCounts: ShopCategoryCounts;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  priceRange: ShopPriceRange;
  maxPrice: number;
  priceRangeCurrency: string;
  onMaxPriceChange: (value: number) => void;
}

export function ShopSidebar({
  categories,
  categoryCounts,
  selectedCategory,
  onCategoryChange,
  collapsed,
  onToggleCollapsed,
  mobileDrawerOpen,
  onCloseMobileDrawer,
  priceRange,
  maxPrice,
  priceRangeCurrency,
  onMaxPriceChange,
}: ShopSidebarProps) {
  return (
    <aside
      className={`
 fixed md:sticky top-24 left-0 h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] z-40
 shop-sidebar-mobile bg-white shadow-xl md:shadow-sm md:border md:border-[#e9ece7]
 overflow-hidden

 ${collapsed ? 'w-20' : 'w-[86vw] max-w-[320px] md:w-64 lg:w-72'}
 ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
 `}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
        {!collapsed && (
          <h3 className="font-display font-semibold text-lg text-[#2d3a2d]">
            Filters
          </h3>
        )}
        <button
          onClick={onToggleCollapsed}
          className="shop-hit-target hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-[#3d7a3d]"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={onCloseMobileDrawer}
          className="shop-hit-target md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="shop-sidebar-scroll overflow-y-auto overflow-x-hidden thin-scrollbar h-[calc(100%-4rem)] p-3 sm:p-4">
        {/* Categories */}
        <div className="mb-6 sm:mb-8">
          {!collapsed && (
            <h4 className="font-medium text-[#2d3a2d] mb-3 text-sm uppercase tracking-wide">
              Categories
            </h4>
          )}
          <div className="space-y-1">
            {categories.map((category) => {
              const Icon = category.Icon;
              // Matched on id only — a `/shop/<slug>` URL therefore highlights
              // nothing. Preserved from Shop.jsx; see the report.
              const isActive = selectedCategory === category.id;
              const categoryCount = categoryCounts[category.id] || 0;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={`
 group relative w-full flex items-center gap-3 px-3 py-3 rounded-xl

 ${isActive
                      ? 'bg-gradient-to-r from-[#3d7a3d] to-[#4a8f4a] text-white shadow-md'
                      : 'hover:bg-gray-50 text-[#2d3a2d]'
                    }
 ${collapsed ? 'justify-center' : ''}
 `}
                  title={collapsed ? category.name : ''}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#3d7a3d]'}`} />
                  {!collapsed && (
                    <>
                      <span className="font-medium text-sm flex-1 text-left">{category.name}</span>
                      <span
                        className={`min-w-7 text-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#3d7a3d]/10 text-[#2d3a2d]'
                        }`}
                      >
                        {categoryCount}
                      </span>
                    </>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible whitespace-nowrap z-10">
                      {category.name} ({categoryCount})
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Range */}
        {!collapsed && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-[#3d7a3d]" />
              <h4 className="font-medium text-[#2d3a2d] text-sm uppercase tracking-wide">
                Price Range
              </h4>
            </div>
            <div className="space-y-4">
              <input
                type="range"
                min="0"
                max={maxPrice}
                value={priceRange[1]}
                onChange={(event) => onMaxPriceChange(parseInt(event.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#3d7a3d]"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#2d3a2d]">
                  {formatCurrency(priceRange[0], priceRangeCurrency)}
                </span>
                <span className="text-sm font-medium text-[#3d7a3d]">
                  {formatCurrency(priceRange[1], priceRangeCurrency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
