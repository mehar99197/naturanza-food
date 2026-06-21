import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useReviews } from '@/context/ReviewContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatPrice, getProductPricing } from '@/lib/utils';
import { motion } from 'framer-motion';
import { buttonTap } from '@/lib/animations';
import { OptimizedImage } from '@/components/OptimizedImage';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';

const LOCAL_CARD_IMAGES = {
 honey: '/images/products/honey.webp',
 tea: '/images/products/tea.webp',
 oil: '/images/products/oil.webp',
 powder: '/images/products/ispaghol_2.webp',
 seeds: '/images/products/ispaghol_1.png',
 supplements: '/images/products/herbs.webp',
 aloe: '/images/products/herbs.webp',
 coconut: '/images/products/coconut-oil.webp',
 herbs: '/images/products/herbs.webp',
 default: '/images/products/honey.webp',
};

function normalizeImageSrc(value) {
 const candidate = String(value || '').trim();
 if (!candidate) {
 return null;
 }

 // Use getAbsoluteImageUrl to convert relative URLs to absolute backend URLs
 return getAbsoluteImageUrl(candidate, { defaultFolder: 'products' });
}

function getProductImageFromPayload(product) {
 const candidates = [];

 if (typeof product?.image_url === 'string') {
 candidates.push(product.image_url);
 }

 if (typeof product?.image === 'string') {
 candidates.push(product.image);
 }

 if (Array.isArray(product?.images)) {
 product.images.forEach((entry) => {
 if (typeof entry === 'string') {
 candidates.push(entry);
 return;
 }

 if (entry && typeof entry === 'object') {
 if (typeof entry.image_url === 'string') {
 candidates.push(entry.image_url);
 }
 if (typeof entry.url === 'string') {
 candidates.push(entry.url);
 }
 }
 });
 }

 for (const candidate of candidates) {
 const normalized = normalizeImageSrc(candidate);
 if (normalized) {
 return normalized;
 }
 }

 return null;
}

function resolveCardImage(product) {
 const directImage = getProductImageFromPayload(product);
 if (directImage) {
 return directImage;
 }

 const text = `${product?.name || ''} ${product?.category_name || ''} ${product?.category || ''}`.toLowerCase();

 if (text.includes('honey')) return LOCAL_CARD_IMAGES.honey;
 if (text.includes('tea') || text.includes('chai')) return LOCAL_CARD_IMAGES.tea;
 if (text.includes('coconut')) return LOCAL_CARD_IMAGES.coconut;
 if (text.includes('oil')) return LOCAL_CARD_IMAGES.oil;
if (text.includes('powder') || text.includes('superfood') || text.includes('greens') || text.includes('ispaghol') || text.includes('psyllium')) return LOCAL_CARD_IMAGES.powder;
  if (text.includes('seed')) return LOCAL_CARD_IMAGES.seeds;
 if (text.includes('supplement') || text.includes('capsule') || text.includes('curcumin') || text.includes('probiotic')) return LOCAL_CARD_IMAGES.supplements;
 if (text.includes('aloe')) return LOCAL_CARD_IMAGES.aloe;
 if (text.includes('herb')) return LOCAL_CARD_IMAGES.herbs;

 return LOCAL_CARD_IMAGES.default;
}

export function ProductCard({ product, viewMode = 'grid', compact = false }) {
 const { addToCart } = useCart();
 const { settings } = useSettings();
 const { isAuthenticated } = useAuth();
 const { getProductReviewStats } = useReviews();
 const { isInWishlist, isUpdating, toggleWishlist } = useWishlist();
 const navigate = useNavigate();
 const isListView = viewMode === 'list';
 const productId = product?.id ?? product?.product_id;
 const isWishlisted = isInWishlist(productId);
 const isWishlistUpdating = isUpdating(productId);
 const pricing = getProductPricing(product, settings);

 const handleAddToCart = async (e) => {
 e.preventDefault();
 e.stopPropagation();
 if (!isAuthenticated) {
 navigate('/login', { state: { from: { pathname: '/shop' } } });
 return;
 }
 await addToCart(product);
 };

 const handleWishlistToggle = async (e) => {
 e.preventDefault();
 e.stopPropagation();

 if (!isAuthenticated) {
 navigate('/login', { state: { from: { pathname: '/shop' } } });
 return;
 }

 if (!productId || isWishlistUpdating) {
 return;
 }

 await toggleWishlist({
 ...product,
 id: productId,
 product_id: productId,
 });
 };

 const badgeColors = {
 Bestseller: 'bg-orange-500',
 Featured: 'bg-orange-500',
 New: 'bg-blue-500',
 Sale: 'bg-red-500',
 };

 const { reviewCount, averageRating } = getProductReviewStats(productId);
 const effectiveReviewCount = reviewCount || 0;
 const effectiveRating = averageRating || 0;
 const filledStars = Math.round(effectiveRating);
 const cardImage = resolveCardImage(product);

 if (isListView) {
 return (
 <div className="shop-product-card bg-white/95 border border-green-100 rounded-2xl overflow-hidden shadow-sm transition-shadow duration-300 ease-out hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
 >
 <div className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3">
 <Link to={`/product/${productId}`} className="block w-24 h-20 sm:w-32 sm:h-24 flex-shrink-0">
 <div className="shop-card-image relative w-full h-full bg-white rounded-xl overflow-hidden flex items-center justify-center p-2">
 <motion.button
 onClick={handleWishlistToggle}
 {...buttonTap}
 disabled={isWishlistUpdating}
 className={`absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full border border-white/80 shadow-md flex items-center justify-center ${
 isWishlisted
 ? 'bg-rose-50 text-rose-500'
 : 'bg-white/90 text-gray-500 hover:text-rose-500'
 } ${isWishlistUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
 aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
 >
 <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
 </motion.button>

 <OptimizedImage
 src={cardImage}
 alt={product.name}
 imgClassName="block w-full h-full max-w-full max-h-full object-contain object-center"
 wrapperClassName="block w-full h-full"
 />
 </div>
 </Link>

 <div className="shop-card-content min-w-0 flex-1">
 <div className="flex items-center gap-1 text-yellow-400 mb-1">
 {[...Array(5)].map((_, index) => (
 <Star
 key={index}
 className={`w-3.5 h-3.5 ${index < filledStars ? 'fill-current text-yellow-400' : 'text-gray-300'}`}
 />
 ))}
 <span className="ml-1 text-xs text-gray-500">({effectiveReviewCount})</span>
 </div>

 <Link to={`/product/${productId}`}>
 <h3 className="font-semibold text-sm text-gray-800 leading-snug truncate md:line-clamp-2 lg:line-clamp-1 break-words mb-1">{product.name}</h3>
 </Link>

 <p className="text-sm text-gray-500 leading-snug truncate md:line-clamp-2 lg:line-clamp-1 break-words mb-2">{product.description}</p>

 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 min-w-0">
 <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
 {formatPrice(pricing.salePrice, settings.currency)}
 </span>
 {pricing.onSale && (
 <>
 <span className="text-xs text-gray-400 line-through whitespace-nowrap">
 {formatPrice(pricing.base, settings.currency)}
 </span>
 <span className="text-[10px] font-bold text-rose-600 bg-rose-50 rounded px-1 py-0.5 whitespace-nowrap">
 {pricing.effectivePct}% OFF
 </span>
 </>
 )}
 </div>

 <motion.button
 onClick={handleAddToCart}
 {...buttonTap}
 className="shop-hit-target w-7 h-7 rounded-full bg-green-700 text-white flex items-center justify-center flex-shrink-0"
 aria-label="Add to Cart"
 >
 <ShoppingCart className="w-3.5 h-3.5" />
 </motion.button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 const imageBgColors = [
 'bg-green-50', 'bg-purple-50', 'bg-orange-50', 'bg-cyan-50',
 'bg-yellow-50', 'bg-lime-50', 'bg-pink-50', 'bg-blue-50',
 ];
 const bgColor = imageBgColors[(parseInt(productId) || 0) % imageBgColors.length];

 return (
 <div className="shop-product-card bg-white rounded-xl overflow-hidden h-full min-w-0 flex flex-col shadow-sm border border-gray-100 transition-shadow duration-300 ease-out hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
 >
 <Link to={`/product/${productId}`} className="block">
 <div className="relative">
 <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
 {pricing.onSale && (
 <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-md bg-gradient-to-r from-rose-500 to-red-600">
 {pricing.effectivePct}% OFF
 </span>
 )}
 {product.badge && (
 <span
 className={`rounded-full px-3 py-1 text-xs font-bold text-white shadow-md ${badgeColors[product.badge] || 'bg-orange-500'}`}
 >
 {product.badge}
 </span>
 )}
 </div>

 <motion.button
 onClick={handleWishlistToggle}
 {...buttonTap}
 disabled={isWishlistUpdating}
 className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full border border-white/90 shadow-md flex items-center justify-center backdrop-blur ${
 isWishlisted
 ? 'bg-rose-50 text-rose-500'
 : 'bg-white/90 text-gray-500 hover:text-rose-500'
 } ${isWishlistUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
 aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
 >
 <Heart className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isWishlisted ? 'fill-current' : ''}`} />
 </motion.button>

 <div className={`shop-card-image relative overflow-hidden ${bgColor} flex items-center justify-center ${compact ? 'h-36 sm:h-40 p-2.5' : 'h-44 sm:h-48 p-3 sm:p-3.5'}`}>
 <OptimizedImage
 src={cardImage}
 alt={product.name}
 imgClassName="block w-full h-full max-w-full max-h-full object-contain object-center"
 wrapperClassName="block w-full h-full"
 />
 </div>
 </div>
 </Link>

 <div className={`shop-card-content flex flex-col flex-1 ${compact ? 'p-2' : 'p-3 sm:p-3.5'}`}>
 {/* Badge category pill */}
 <span className="inline-block bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full mb-1 w-fit">
 {product.category_name || product.category || 'Herbal'}
 </span>

 <Link to={`/product/${product.id}`}>
 <h3 className="font-semibold text-gray-800 leading-tight mb-0.5 text-sm line-clamp-1">{product.name}</h3>
 </Link>

 {/* Stars - moved up, removed description */}
 <div className="flex items-center gap-1 mb-1.5">
 {[...Array(5)].map((_, index) => (
 <Star
 key={index}
 className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${index < filledStars ? 'fill-current text-yellow-400' : 'text-gray-200'}`}
 />
 ))}
 <span className="ml-1 text-xs text-gray-400">({effectiveReviewCount})</span>
 </div>

 <div className="flex items-end justify-between gap-2 mt-auto min-w-0">
 <div className="flex flex-col min-w-0">
 <span className={`${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} font-extrabold text-green-600 whitespace-nowrap leading-tight`}>
 {formatPrice(pricing.salePrice, settings.currency)}
 </span>
 {pricing.onSale && (
 <span className={`${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'} text-gray-400 line-through whitespace-nowrap leading-tight`}>
 {formatPrice(pricing.base, settings.currency)}
 </span>
 )}
 </div>

 <motion.button
 onClick={handleAddToCart}
 {...buttonTap}
 className={`shop-hit-target shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-600 text-white flex items-center justify-center shadow-sm ${compact ? 'text-xs' : 'text-sm'}`}
 aria-label="Add to Cart"
 >
 <ShoppingCart className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
 </motion.button>
 </div>
 </div>
 </div>
 );
}
