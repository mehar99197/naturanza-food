"use client";

/**
 * Live-suggestion search field, ported from frontend/src/components/SearchBar.jsx.
 *
 * Distinct from SearchModal: this is the inline, embeddable field used by the
 * shop pages, and it filters an already-loaded product array in the browser
 * rather than issuing a request. The modal in the header only ever navigates.
 *
 * No routing to migrate — it reports selections to its parent and never
 * navigates itself. The value is controlled by that parent; only focus, the
 * derived suggestions and the keyboard cursor live here.
 */

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { useSettings } from "@/providers/SettingsProvider";

import { SearchSuggestions } from "./SearchSuggestions";
import type {
  SearchBarProduct,
  SearchBarSettings,
  Suggestions,
} from "./searchBarTypes";

export type { SearchBarProduct, SearchBarSettings } from "./searchBarTypes";

export interface SearchBarProps {
  /** Current search value. */
  value: string;
  /** Callback when the search value changes. */
  onChange: (value: string) => void;
  /** All products to draw suggestions from. */
  products?: SearchBarProduct[];
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  products = [],
  placeholder = 'Search products...',
}: SearchBarProps) {
  const { settings }: { settings: SearchBarSettings } = useSettings();
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>({ products: [], categories: [] });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = String(value ?? '');
  // Filtering runs against every loaded product, so it is debounced rather than
  // run per keystroke.
  const debouncedSearch = useDebounce(normalizedValue, 300);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate suggestions based on search value
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      const searchLower = debouncedSearch.toLowerCase();

      // Filter products by name, category, or description
      const matchedProducts = products
        .filter((product) => {
          const name = String(product?.name || '').toLowerCase();
          const category = String(product?.category_name || product?.category || '').toLowerCase();
          const description = String(product?.description || '').toLowerCase();

          return (
            name.includes(searchLower) ||
            category.includes(searchLower) ||
            description.includes(searchLower)
          );
        })
        .slice(0, 6); // Limit to 6 suggestions

      // Get unique categories from search
      const matchedCategories = [...new Set(
        products
          .map((p) => String(p?.category_name || p?.category || '').trim())
          .filter((category) => category && category.toLowerCase().includes(searchLower))
      )].slice(0, 3);

      setSuggestions({
        products: matchedProducts,
        categories: matchedCategories
      });
    } else {
      setSuggestions({ products: [], categories: [] });
    }
  }, [debouncedSearch, products]);

  const handleClear = () => {
    onChange('');
    setSuggestions({ products: [], categories: [] });
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (productName: string | null | undefined) => {
    onChange(String(productName || ''));
    setIsFocused(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalSuggestions = (suggestions.products?.length || 0) + (suggestions.categories?.length || 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalSuggestions - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      // The cursor runs over products first, then categories, so an index past
      // the product count addresses the category list.
      if (selectedIndex < suggestions.products?.length) {
        const product = suggestions.products[selectedIndex];
        handleSuggestionClick(product?.name || '');
      } else {
        const categoryIndex = selectedIndex - suggestions.products?.length;
        const category = suggestions.categories[categoryIndex];
        handleSuggestionClick(category);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setSelectedIndex(-1);
    }
  };

  const showSuggestions = isFocused && normalizedValue.length >= 2 &&
    (suggestions.products?.length > 0 || suggestions.categories?.length > 0);

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#6b7a6b]" />
        <input
          type="text"
          value={normalizedValue}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-2.5 sm:py-3 md:py-4 bg-white border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#3d7a3d] text-sm sm:text-base text-[#2d3a2d] placeholder:text-[#6b7a6b] shadow-sm hover:shadow-md"
        />
        {normalizedValue && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-transparent hover:bg-gray-100 transition-colors duration-150"
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-[#6b7a6b]" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <SearchSuggestions
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          query={normalizedValue}
          settings={settings}
          onSelect={handleSuggestionClick}
        />
      )}

      {/* No Results */}
      {isFocused && normalizedValue.length >= 2 && suggestions.products?.length === 0 && suggestions.categories?.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-7 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-[#6b7a6b] mb-1">No results found</p>
            <p className="text-sm text-[#6b7a6b]">Try a different search term</p>
          </div>
        </div>
      )}
    </div>
  );
}
