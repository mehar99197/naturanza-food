import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Package } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';

const getSearchResultImage = (product) => {
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
 * SearchBar component with live suggestions
 * @param {Object} props
 * @param {string} props.value - Current search value
 * @param {Function} props.onChange - Callback when search value changes
 * @param {Array} props.products - Array of all products for suggestions
 * @param {string} props.placeholder - Placeholder text
 */
export function SearchBar({ value, onChange, products = [], placeholder = 'Search products...' }) {
 const { settings } = useSettings();
 const [isFocused, setIsFocused] = useState(false);
 const [suggestions, setSuggestions] = useState({ products: [], categories: [] });
 const [selectedIndex, setSelectedIndex] = useState(-1);
 const searchRef = useRef(null);
 const normalizedValue = String(value ?? '');
 const debouncedSearch = useDebounce(normalizedValue, 300);

 // Close suggestions when clicking outside
 useEffect(() => {
 const handleClickOutside = (event) => {
 if (searchRef.current && !searchRef.current.contains(event.target)) {
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

 const handleSuggestionClick = (productName) => {
 onChange(String(productName || ''));
 setIsFocused(false);
 setSelectedIndex(-1);
 };

 const handleKeyDown = (e) => {
 const totalSuggestions = (suggestions.products?.length || 0) + (suggestions.categories?.length || 0);
 
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setSelectedIndex(prev => (prev < totalSuggestions - 1 ? prev + 1 : prev));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
 } else if (e.key === 'Enter' && selectedIndex >= 0) {
 e.preventDefault();
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

 const highlightMatch = (text, query) => {
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
 onClick={() => handleSuggestionClick(category)}
 className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-green-50 flex items-center gap-3 ${
 selectedIndex === (suggestions.products?.length || 0) + index ? 'bg-green-50' : ''
 }`}
 >
 <TrendingUp className="w-4 h-4 text-[#3d7a3d] flex-shrink-0" />
 <span className="text-[#2d3a2d] capitalize">
 {highlightMatch(category, normalizedValue)}
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
 onClick={() => handleSuggestionClick(product?.name || '')}
 className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-green-50 flex items-start gap-3 sm:gap-4 ${
 selectedIndex === index ? 'bg-green-50' : ''
 }`}
 >
<div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
  <img
  src={getSearchResultImage(product)}
  alt={String(product?.name || 'Product')}
  className="w-full h-full object-contain"
  />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[#2d3a2d] font-medium truncate">
 {highlightMatch(product?.name || '', normalizedValue)}
 </p>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-sm text-[#3d7a3d] font-semibold">
 {formatPrice(product.price, settings.currency)}
 </span>
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
