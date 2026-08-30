"use client";

// "use client": every row is a click target.

import { Package, TrendingUp } from "lucide-react";

import { formatPrice, getProductPricing } from "@/lib/utils";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

import type {
  SearchBarProduct,
  SearchBarSettings,
  Suggestions,
} from "./searchBarTypes";

/**
 * Falls back to a category-shaped stock photo when a product has no image of its
 * own, so a suggestion row is never a broken thumbnail.
 */
export const getSearchResultImage = (product: SearchBarProduct): string => {
  const img = product?.image_url || product?.image;
  if (img) return getAbsoluteImageUrl(img, { defaultFolder: 'products' });
  const text = `${product?.name || ''} ${product?.category_name || ''} ${product?.category || ''}`.toLowerCase();
  if (text.includes('ispaghol') || text.includes('psyllium')) return '/images/products/ispaghol_2.webp';
  if (text.includes('honey')) return '/images/products/honey.webp';
  if (text.includes('coconut')) return '/images/products/coconut-oil.webp';
  if (text.includes('oil')) return '/images/products/oil.webp';
  return '/images/products/herbs.webp';
};

/**
 * Wraps every case-insensitive occurrence of `query` in a highlight span.
 *
 * The query is regex-escaped before use: a visitor typing "50% (off)" would
 * otherwise build an invalid pattern and throw on every keystroke.
 */
export const highlightMatch = (
  text: string | null | undefined,
  query: string,
): React.ReactNode => {
  const safeText = String(text || '');
  const safeQuery = String(query || '');
  if (!safeQuery.trim()) return safeText;
  const escapedQuery = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const parts = safeText.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === safeQuery.toLowerCase() ? (
      <span key={index} className="bg-yellow-200 text-[#2d3a2d] font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );
};

export interface SearchSuggestionsProps {
  suggestions: Suggestions;
  /**
   * Keyboard cursor across the flattened list: products first, then categories.
   * -1 means nothing is selected.
   */
  selectedIndex: number;
  /** Current query, used to highlight the matching substring. */
  query: string;
  settings: SearchBarSettings;
  onSelect: (value: string | null | undefined) => void;
}

export function SearchSuggestions({
  suggestions,
  selectedIndex,
  query,
  settings,
  onSelect,
}: SearchSuggestionsProps) {
  return (
    <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[65vh] overflow-y-auto thin-scrollbar">
      {/* Categories */}
      {suggestions.categories?.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-3 sm:px-4 py-2 bg-gray-50">
            <p className="text-xs font-semibold text-[#6b7a6b] uppercase tracking-wide">
              Categories
            </p>
          </div>
          {suggestions.categories.map((category, index) => (
            <button
              key={category}
              onClick={() => onSelect(category)}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-green-50 flex items-center gap-3 ${
                selectedIndex === (suggestions.products?.length || 0) + index ? 'bg-green-50' : ''
              }`}
            >
              <TrendingUp className="w-4 h-4 text-[#3d7a3d] flex-shrink-0" />
              <span className="text-[#2d3a2d] capitalize">
                {highlightMatch(category, query)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      {suggestions.products?.length > 0 && (
        <div>
          <div className="px-3 sm:px-4 py-2 bg-gray-50">
            <p className="text-xs font-semibold text-[#6b7a6b] uppercase tracking-wide">
              Products
            </p>
          </div>
          {suggestions.products.map((product, index) => (
            <button
              key={product?.id || `${product?.name || 'product'}-${index}`}
              onClick={() => onSelect(product?.name || '')}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-green-50 flex items-start gap-3 sm:gap-4 ${
                selectedIndex === index ? 'bg-green-50' : ''
              }`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getSearchResultImage(product)}
                  alt={String(product?.name || 'Product')}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#2d3a2d] font-medium truncate">
                  {highlightMatch(product?.name || '', query)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const pr = getProductPricing(product, settings);
                    return (
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm text-[#3d7a3d] font-semibold">
                          {formatPrice(pr.salePrice, settings.currency)}
                        </span>
                        {pr.onSale && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(pr.base, settings.currency)}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-[#6b7a6b] capitalize">
                    {String(product.category_name || product.category || 'General').replace(/-/g, ' ')}
                  </span>
                </div>
              </div>
              <Package className="w-4 h-4 text-[#6b7a6b] flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {/* Search Tip */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-t border-gray-100">
        <p className="text-xs text-[#6b7a6b] text-center">
          Press <kbd className="px-2 py-1 bg-white rounded border text-[#2d3a2d] font-mono">Enter</kbd> to search all results
        </p>
      </div>
    </div>
  );
}
