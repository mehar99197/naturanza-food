import { useState, useMemo, useEffect, useRef } from"react";
import { useSearchParams } from"react-router-dom";
import { 
 Grid3X3, 
 LayoutList, 
 X, 
 ChevronLeft, 
 ChevronRight,
 Droplet,
 Flower2,
 Coffee,
 Pill,
 ShoppingBag,
 DollarSign,
 Menu
} from"lucide-react";
import { ProductCard } from"@/components/ProductCard";
import { ProductCardSkeleton } from"@/components/Skeletons/ProductCardSkeleton";
import { SearchBar } from"@/components/SearchBar";
import { useSettings } from"@/context/SettingsContext";
import { useProducts } from"@/context/ProductContext";
import { formatCurrency, formatPrice } from"@/lib/utils";
import { convertFromPkr, hasExchangeRate } from"@/lib/exchangeRates";
import { categoryAPI } from"@/services/api";
import { ShopSEO } from "@/components/SEO";
import { ShopBreadcrumbStructuredData } from "@/components/StructuredData";
import { Helmet } from "react-helmet-async";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function Shop() {
 const { settings, exchangeRates } = useSettings();
 const { getActiveProducts } = useProducts();
 const [searchParams, setSearchParams] = useSearchParams();
 const [viewMode, setViewMode] = useState("grid");
 const [sortBy, setSortBy] = useState("featured");
 const [isLoading, setIsLoading] = useState(true);
 const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();
 const { ref: toolbarRef, isVisible: toolbarVisible } = useScrollReveal({ threshold: 0.12 });
 const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.12 });
 
 // Sidebar state
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

 const currencyCode = String(settings.currency || "PKR").toUpperCase();
 const hasRate = hasExchangeRate(currencyCode);
 const baseMaxPrice = 10000;
 const computedMaxPrice = hasRate
 ? Math.round(convertFromPkr(baseMaxPrice, currencyCode) || baseMaxPrice)
 : baseMaxPrice;
 const maxPrice = Math.max(1, computedMaxPrice);
 const priceRangeCurrency = hasRate ? currencyCode : "PKR";
 const [priceRange, setPriceRange] = useState([0, maxPrice]);
 const currencyRef = useRef(currencyCode);
 const [searchQuery, setSearchQuery] = useState("");

 const selectedCategory = searchParams.get("category") ||"all";

 const [categories, setCategories] = useState([
 { id:"all", name:"All Products", icon: ShoppingBag },
 ]);

 useEffect(() => {
 let isMounted = true;
 let loadingTimerId;

 const fetchCategories = async ({ showLoader = false } = {}) => {
 try {
 if (showLoader) {
 setIsLoading(true);
 }

 const data = await categoryAPI.getAll({ category_type: "shop" });
 const list = Array.isArray(data) ? data : data.data || [];
 const icons = [Droplet, Flower2, Coffee, Pill, ShoppingBag];
 const dynamic = list.map((cat, idx) => ({
 id: cat.id,
 name: cat.name,
 icon: icons[idx % icons.length],
 }));

 if (!isMounted) {
 return;
 }

 setCategories([{ id:"all", name:"All Products", icon: ShoppingBag }, ...dynamic]);
 } catch (err) {
 } finally {
 if (showLoader) {
 // Simulate minimum loading time for better UX.
 loadingTimerId = setTimeout(() => {
 if (isMounted) {
 setIsLoading(false);
 }
 }, 800);
 }
 }
 };

  fetchCategories({ showLoader: true });
  const intervalId = setInterval(() => {
  if (isMounted) {
  fetchCategories({ showLoader: false });
  }
  }, 30000);

 return () => {
 isMounted = false;
 clearInterval(intervalId);
 if (loadingTimerId) {
 clearTimeout(loadingTimerId);
 }
 };
 }, []);

 const products = useMemo(() => getActiveProducts(), [getActiveProducts]);

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
 const selectedCategoryName = useMemo(() => {
 return (
 categories.find((cat) => String(cat.id) === String(selectedCategory))?.name ||
"All Products"
 );
 }, [selectedCategory, categories]);

 const categoryCounts = useMemo(() => {
 const counts = {
 all: products.length,
 };

 categories.forEach((cat) => {
 if (cat.id ==="all") return;
 counts[cat.id] = products.filter((p) => {
 const catIdString = String(cat.id);
 return (
 String(p.category_id) === catIdString ||
 p.category === catIdString ||
 p.category === cat.name ||
 p.category_name === cat.name
 );
 }).length;
 });

 return counts;
 }, [products, categories]);

 // Initialize search query from URL parameter
 useEffect(() => {
 const searchParam = searchParams.get("search");
 if (searchParam) {
 setSearchQuery(searchParam);
 // Remove search param from URL after setting it
 const nextParams = new URLSearchParams(searchParams);
 nextParams.delete("search");
 setSearchParams(nextParams, { replace: true });
 }
 }, [searchParams, setSearchParams]);

 const filteredProducts = useMemo(() => {
 let result = [...products];

 // Filter by search query
 if (searchQuery.trim()) {
 const query = searchQuery.toLowerCase();
 result = result.filter(
 (p) => {
 const name = String(p?.name || '').toLowerCase();
 const category = String(p?.category_name || p?.category || '').toLowerCase();
 const description = String(p?.description || '').toLowerCase();

 return (
 name.includes(query) ||
 category.includes(query) ||
 description.includes(query)
 );
 },
 );
 }

 // Filter by category
 if (selectedCategory !=="all") {
 const selectedCategoryEntry = categories.find(
 (c) => String(c.id) === String(selectedCategory),
 );
 const selectedCategoryDisplayName = String(selectedCategoryEntry?.name || "");
 const normalizedSelectedCategory = String(selectedCategory).toLowerCase();

 const startupCategoryKeywordMap = {
 honey:["honey"],
 "herbal-oils":["coconut"],
 "organic-powders":["ispaghol", "psyllium"],
 };

 const startupCategoryKeywords = startupCategoryKeywordMap[normalizedSelectedCategory] || [];

 result = result.filter((p) => {
 const directCategoryMatch =
 String(p.category_id) === String(selectedCategory) ||
 String(p.category) === String(selectedCategory) ||
 String(p.category_name) === String(selectedCategory) ||
 String(p.category_name) === selectedCategoryDisplayName;

 if (directCategoryMatch) {
 return true;
 }

 if (startupCategoryKeywords.length === 0) {
 return false;
 }

 const searchableText = [
 p?.slug,
 p?.name,
 p?.category,
 p?.category_name,
 p?.description,
 ]
 .map((value) => String(value || "").toLowerCase())
 .join(" ");

 return startupCategoryKeywords.some((keyword) => searchableText.includes(keyword));
 });
 }

 // Filter by price
 result = result.filter((p) => {
 const basePrice = Number(p.price);
 const convertedPrice = hasRate
 ? convertFromPkr(basePrice, currencyCode)
 : basePrice;
 const priceValue = Number.isFinite(convertedPrice) ? convertedPrice : basePrice;
 return priceValue >= priceRange[0] && priceValue <= priceRange[1];
 });

 // Sort
 switch (sortBy) {
 case"price-low":
 result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
 break;
 case"price-high":
 result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
 break;
 case"rating":
 result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
 break;
 case"newest":
 result.sort((a, b) => {
 const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
 const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
 return bDate - aDate;
 });
 break;
 default:
 break;
 }

 return result;
 }, [
 selectedCategory,
 sortBy,
 priceRange,
 searchQuery,
 products,
 settings.currency,
 exchangeRates.updatedAt,
 hasRate,
 currencyCode,
 ]);

 const handleCategoryChange = (category) => {
 const value = String(category);
 const nextParams = new URLSearchParams(searchParams);
 if (value ==="all") {
 nextParams.delete("category");
 } else {
 nextParams.set("category", value);
 }
 setSearchParams(nextParams, { replace: true });
 };

 return (
<>
  <ShopSEO category={selectedCategory !== 'all' ? selectedCategory : null} />
  <ShopBreadcrumbStructuredData category={selectedCategory !== 'all' ? selectedCategory : null} />
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
 <aside
 className={`
 fixed md:sticky top-24 left-0 h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] z-40
 shop-sidebar-mobile bg-white shadow-xl md:shadow-sm md:border md:border-[#e9ece7]
 overflow-hidden
 
 ${sidebarCollapsed ? 'w-20' : 'w-[86vw] max-w-[320px] md:w-64 lg:w-72'}
 ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
 `}
 >
 {/* Sidebar Header */}
 <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
 {!sidebarCollapsed && (
 <h3 className="font-display font-semibold text-lg text-[#2d3a2d]">
 Filters
 </h3>
 )}
 <button
 onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
 className="shop-hit-target hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-[#3d7a3d]"
 title={sidebarCollapsed ?"Expand sidebar" :"Collapse sidebar"}
 >
 {sidebarCollapsed ? (
 <ChevronRight className="w-5 h-5" />
 ) : (
 <ChevronLeft className="w-5 h-5" />
 )}
 </button>
 <button
 onClick={() => setMobileDrawerOpen(false)}
 className="shop-hit-target md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Sidebar Content */}
 <div className="shop-sidebar-scroll overflow-y-auto overflow-x-hidden thin-scrollbar h-[calc(100%-4rem)] p-3 sm:p-4">
 {/* Categories */}
 <div className="mb-6 sm:mb-8">
 {!sidebarCollapsed && (
 <h4 className="font-medium text-[#2d3a2d] mb-3 text-sm uppercase tracking-wide">
 Categories
 </h4>
 )}
 <div className="space-y-1">
 {categories.map((cat) => {
 const Icon = cat.icon || ShoppingBag;
 const isActive = String(selectedCategory) === String(cat.id);
 const categoryCount = categoryCounts[cat.id] || 0;
 
 return (
 <button
 key={cat.id}
 onClick={() => handleCategoryChange(cat.id)}
 className={`
 group relative w-full flex items-center gap-3 px-3 py-3 rounded-xl
 
 ${isActive 
 ? 'bg-gradient-to-r from-[#3d7a3d] to-[#4a8f4a] text-white shadow-md' 
 : 'hover:bg-gray-50 text-[#2d3a2d]'
 }
 ${sidebarCollapsed ? 'justify-center' : ''}
 `}
 title={sidebarCollapsed ? cat.name : ''}
 >
 <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#3d7a3d]'}`} />
 {!sidebarCollapsed && (
 <>
 <span className="font-medium text-sm flex-1 text-left">{cat.name}</span>
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
 {sidebarCollapsed && (
 <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible whitespace-nowrap z-10">
 {cat.name} ({categoryCount})
 <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
 </div>
 )}
 </button>
 );
 })}
 </div>
 </div>

 {/* Price Range */}
 {!sidebarCollapsed && (
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
 onChange={(e) =>
 setPriceRange([priceRange[0], parseInt(e.target.value)])
 }
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

 {/* Main Content */}
 <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}`}>
 <div className="container-custom">
 {/* Header */}
 <div
 className={`mb-5 sm:mb-6 reveal reveal-left ${
 headerVisible ? 'active' : ''
 }`}
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
 onClick={() => setMobileDrawerOpen(true)}
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
 onChange={setSearchQuery}
 products={products}
 placeholder="Search products..."
 />
 </div>

 {/* Active Filters */}
 {(searchQuery || selectedCategory !=="all" || priceRange[1] !== maxPrice) && (
 <div className="shop-active-filters flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto thin-scrollbar pb-1">
 <span className="text-sm text-[#6b7a6b] font-medium whitespace-nowrap">Active filters:</span>
 {searchQuery && (
 <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3d7a3d] text-white text-sm rounded-full shadow-sm whitespace-nowrap">
 {searchQuery}
 <button
 onClick={() => setSearchQuery("")}
 className="hover:bg-white/20 rounded-full p-0.5"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </span>
 )}
 {selectedCategory !=="all" && (
 <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full shadow-sm capitalize whitespace-nowrap">
 {categories.find(c => String(c.id) === String(selectedCategory))?.name}
 <button
 onClick={() => handleCategoryChange("all")}
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
 onClick={() => setPriceRange([0, maxPrice])}
 className="hover:bg-white/20 rounded-full p-0.5"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </span>
 )}
 <button
 onClick={() => {
 setSearchQuery("");
 handleCategoryChange("all");
 setPriceRange([0, maxPrice]);
 }}
 className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline px-2 whitespace-nowrap"
 >
 Clear all
 </button>
 </div>
 )}
 </div>

 {/* Toolbar */}
 <div
 className={`shop-toolbar-compact bg-white border border-[#e8ece6] rounded-2xl p-2.5 sm:p-3.5 md:p-3.5 mb-5 shadow-[0_2px_10px_rgba(23,35,19,0.05)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 reveal reveal-right ${
 toolbarVisible ? 'active' : ''
 }`}
 ref={toolbarRef}
 >
 <span className="text-[#6b7a6b] text-sm font-medium order-2 sm:order-1">
 <span className="text-[#3d7a3d] font-bold">{filteredProducts.length}</span> products in {selectedCategoryName}
 </span>

 <div className="shop-controls-row w-full sm:w-auto flex items-center gap-2 md:gap-3 order-1 sm:order-2">
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
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
 onClick={() => setViewMode("grid")}
 className={`shop-hit-target p-1.5 sm:p-2 rounded-lg ${
 viewMode ==="grid" 
 ?"bg-[#3d7a3d] text-white" 
 :"hover:bg-gray-50 text-gray-600"
 }`}
 title="Grid view"
 >
 <Grid3X3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
 </button>
 <button
 onClick={() => setViewMode("list")}
 className={`shop-hit-target p-1.5 sm:p-2 rounded-lg ${
 viewMode ==="list" 
 ?"bg-[#3d7a3d] text-white" 
 :"hover:bg-gray-50 text-gray-600"
 }`}
 title="List view"
 >
 <LayoutList className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
 </button>
 </div>
 </div>
 </div>

 {/* Products Grid */}
 <div
 className={`reveal reveal-right ${gridVisible ? 'active' : ''}`}
 ref={gridRef}
 >
 {isLoading ? (
 <div
 className={`shop-grid-compact grid gap-3 sm:gap-5 md:gap-5 lg:gap-6 ${
 viewMode ==="grid"
 ?"grid-cols-2 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
 :"grid-cols-1"
 }`}
 >
 <ProductCardSkeleton count={8} viewMode={viewMode} />
 </div>
 ) : filteredProducts.length > 0 ? (
 <div
 className={`shop-grid-compact grid gap-3 sm:gap-5 md:gap-5 lg:gap-6 ${
 viewMode ==="grid"
 ?"grid-cols-2 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
 :"grid-cols-1"
 }`}
 >
 {filteredProducts.map((product, index) => (
 <div
 key={product.id}
 className={viewMode === "grid" ? "h-full min-w-0 w-full max-w-[15.75rem] mx-auto" : "h-full min-w-0"}
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
 :"Try adjusting your filters to see more products."
 }
 </p>
 <button
 onClick={() => {
 setSearchQuery("");
 handleCategoryChange("all");
 setPriceRange([0, maxPrice]);
 }}
 className="px-6 py-3 bg-[#3d7a3d] text-white rounded-xl font-medium hover:bg-[#2d5a2d] shadow-md"
 >
 Clear all filters
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </main>
 </>
 );
}
