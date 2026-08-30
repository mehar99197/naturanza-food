"use client";

// "use client": controlled input, form submit, and a backdrop click handler.

import { Search, TrendingUp, X } from "lucide-react";

import { POPULAR_SEARCHES } from "./navLinks";

export interface SearchModalProps {
  /**
   * Owned by Navigation, not by this component. Closing via the X, the backdrop
   * or Escape deliberately leaves the typed text in place for the next open —
   * only submitting or picking a popular term clears it. Holding the state here
   * would reset it on every close, because the modal unmounts.
   */
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClose: () => void;
  /** Submits the typed query. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Runs one of the suggested terms. */
  onPopularSearch: (term: string) => void;
}

export function SearchModal({
  searchQuery,
  onSearchQueryChange,
  onClose,
  onSubmit,
  onPopularSearch,
}: SearchModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Search Content */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 md:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 md:hover:bg-gray-100 rounded-full active:scale-95"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h2 className="text-2xl font-bold text-[#2d3a2d] mb-6">
          Search Products
        </h2>

        {/* Search Form */}
        <form onSubmit={onSubmit} className="mb-6">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 md:group-hover:text-green-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search for organic products..."
              className="w-full pl-14 pr-32 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 focus:bg-white text-gray-800 placeholder:text-gray-400"
              autoFocus
            />
            <button
              type="submit"
              className="nav-search-modal-submit-btn absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-xl font-semibold md:hover:from-green-700 md:hover:to-green-800 shadow-md md:hover:shadow-lg active:scale-95 transition-[background-color,box-shadow] duration-200"
            >
              Search
            </button>
          </div>
        </form>

        {/* Popular Searches */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Popular Searches
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => onPopularSearch(term)}
                className="inline-flex items-center gap-1 text-sm bg-gradient-to-br from-gray-50 to-green-50 md:hover:from-green-100 md:hover:to-green-100 text-gray-700 md:hover:text-green-700 px-4 py-2 rounded-full border border-gray-200 md:hover:border-green-300 shadow-sm md:hover:shadow-md font-medium active:scale-95"
              >
                <TrendingUp className="w-3 h-3" />
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-100">
          <p className="text-xs text-gray-600">
            💡 <span className="font-semibold">Tip:</span> Try searching by
            product name, category, or ingredients for better results!
          </p>
        </div>
      </div>
    </div>
  );
}
