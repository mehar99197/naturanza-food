"use client";

/**
 * Result count, sort menu and the grid/list toggle, ported from the toolbar
 * block of frontend/src/pages/Shop.jsx.
 */

import { Grid3X3, LayoutList } from "lucide-react";

import { useScrollReveal } from "@/hooks/useScrollReveal";

import { normalizeSortKey } from "./filtering";
import type { ShopSortKey, ShopViewMode } from "./types";

export interface ShopToolbarProps {
  resultCount: number;
  categoryName: string;
  sortBy: ShopSortKey;
  onSortChange: (value: ShopSortKey) => void;
  viewMode: ShopViewMode;
  onViewModeChange: (value: ShopViewMode) => void;
}

export function ShopToolbar({
  resultCount,
  categoryName,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: ShopToolbarProps) {
  const { ref: toolbarRef, isVisible: toolbarVisible } = useScrollReveal({ threshold: 0.12 });

  return (
    <div
      className={`shop-toolbar-compact bg-white border border-[#e8ece6] rounded-2xl p-2.5 sm:p-3.5 md:p-3.5 mb-5 shadow-[0_2px_10px_rgba(23,35,19,0.05)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 reveal reveal-right ${
        toolbarVisible ? 'active' : ''
      }`}
      ref={toolbarRef}
    >
      <span className="text-[#6b7a6b] text-sm font-medium order-2 sm:order-1">
        <span className="text-[#3d7a3d] font-bold">{resultCount}</span> products in {categoryName}
      </span>

      <div className="shop-controls-row w-full sm:w-auto flex items-center gap-2 md:gap-3 order-1 sm:order-2">
        <select
          value={sortBy}
          onChange={(event) => onSortChange(normalizeSortKey(event.target.value))}
          className="shop-select-compact flex-1 min-w-0 sm:flex-none sm:w-[190px] md:w-[175px] lg:w-[190px] px-3 py-1.5 sm:py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3d7a3d] text-sm font-medium bg-white"
        >
          <option value="featured">Featured</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">Newest</option>
        </select>

        <div className="flex shrink-0 border-2 border-gray-200 rounded-xl overflow-hidden bg-[#f7f8f6] p-0.5">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`shop-hit-target p-1.5 sm:p-2 rounded-lg ${
              viewMode === "grid"
                ? "bg-[#3d7a3d] text-white"
                : "hover:bg-gray-50 text-gray-600"
            }`}
            title="Grid view"
          >
            <Grid3X3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`shop-hit-target p-1.5 sm:p-2 rounded-lg ${
              viewMode === "list"
                ? "bg-[#3d7a3d] text-white"
                : "hover:bg-gray-50 text-gray-600"
            }`}
            title="List view"
          >
            <LayoutList className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
