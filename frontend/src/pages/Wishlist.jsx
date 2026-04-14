import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { formatPrice } from '@/lib/utils';

export function Wishlist() {
 const { items, removeFromWishlist, clearWishlist } = useWishlist();
 const { addToCart } = useCart();
 const { settings } = useSettings();
 const { ref, isVisible } = useScrollReveal();

 const handleAddToCart = (product) => {
 addToCart(product);
 };

 const handleAddAllToCart = () => {
 items.forEach(product => addToCart(product));
 };

 if (items.length === 0) {
 return (
 <main className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-[#faf8f3]">
 <div className="container-custom">
 <div className="max-w-2xl mx-auto text-center py-20">
 <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
 <Heart className="w-16 h-16 text-red-400" />
 </div>
 <h1 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mb-4">
 Your Wishlist is Empty
 </h1>
 <p className="text-[#6b7a6b] mb-8 text-base">
 Save your favorite products for later by clicking the heart icon
 </p>
 <Link
 to="/shop"
 className="inline-flex items-center gap-2 btn-primary"
 >
 <ShoppingBag className="w-5 h-5" />
 Start Shopping
 </Link>
 </div>
 </div>
 </main>
 );
 }

 return (
 <main className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-[#faf8f3]">
 <div className="container-custom">
 {/* Header */}
 <div className="mb-8" ref={ref}>
 <div className="flex items-center justify-between mb-4">
 <div>
 <h1 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mb-2">
 My Wishlist
 </h1>
 <p className="text-sm text-[#6b7a6b]">
 {items.length} {items.length === 1 ? 'item' : 'items'} saved
 </p>
 </div>
 <div className="flex gap-3">
 <button
 onClick={handleAddAllToCart}
 className="hidden md:inline-flex items-center gap-2 bg-gradient-to-r from-[#3d7a3d] to-[#2d5a2d] text-white px-5 py-2.5 rounded-full font-semibold hover:shadow-xl transform text-sm"
 >
 <ShoppingCart className="w-4 h-4" />
 Add All to Cart
 </button>
 <button
 onClick={clearWishlist}
 className="inline-flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-red-600 text-sm"
 >
 <Trash2 className="w-4 h-4" />
 Clear All
 </button>
 </div>
 </div>
 </div>

 {/* Wishlist Grid */}
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {items.map((product, index) => (
 <div
 key={product.id}
 className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl group border border-gray-100 hover:border-green-200 ${
 isVisible ? '' : 'opacity-0'
 }`}
 style={{ animationDelay: `${index * 0.05}s` }}
 >
 {/* Image */}
 <Link to={`/product/${product.id}`} className="relative block">
 <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
 <img
 src={product.image_url || product.image}
 alt={product.name}
 className="w-full h-full object-contain transform group-"
 />
 </div>
 
 {/* Badge */}
 {product.badge && (
 <span className={`absolute top-4 left-4 px-3 py-1 text-xs font-bold rounded-full shadow-lg ${
 product.badge === 'Sale' 
 ? 'bg-red-500 text-white' 
 : product.badge === 'New'
 ? 'bg-blue-500 text-white'
 : 'bg-[#e8a33d] text-white'
 }`}>
 {product.badge}
 </span>
 )}

 {/* Remove Button */}
 <button
 onClick={(e) => {
 e.preventDefault();
 removeFromWishlist(product.id);
 }}
 className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-red-500 text-gray-700 hover:text-white rounded-full flex items-center justify-center shadow-lg"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </Link>

 {/* Content */}
 <div className="p-5">
 <Link to={`/product/${product.id}`}>
 <h3 className="font-display font-semibold text-base mb-2 hover:text-[#3d7a3d] line-clamp-2">
 {product.name}
 </h3>
 </Link>

 <p className="text-gray-600 text-xs mb-3 line-clamp-2">
 {product.description}
 </p>

 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-xl font-bold text-[#3d7a3d]">
 {formatPrice(product.price, settings.currency)}
 </span>
 {product.originalPrice && (
 <span className="text-xs text-gray-400 line-through">
 {formatPrice(product.originalPrice, settings.currency)}
 </span>
 )}
 </div>
 </div>

 {/* Actions */}
 <div className="flex gap-2">
 <button
 onClick={() => handleAddToCart(product)}
 className="flex-1 bg-gradient-to-r from-[#3d7a3d] to-[#2d5a2d] text-white py-2 rounded-xl font-semibold hover:shadow-lg flex items-center justify-center gap-2 text-sm"
 >
 <ShoppingCart className="w-4 h-4" />
 Add to Cart
 </button>
 <Link
 to={`/product/${product.id}`}
 className="px-3 py-2 border-2 border-[#3d7a3d] text-[#3d7a3d] rounded-xl font-semibold hover:bg-[#3d7a3d] hover:text-white flex items-center justify-center"
 >
 <ArrowRight className="w-4 h-4" />
 </Link>
 </div>

 {/* Added Date */}
 {product.addedAt && (
 <p className="text-xs text-gray-400 mt-3 text-center">
 Added {new Date(product.addedAt).toLocaleDateString()}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Mobile Add All Button */}
 <div className="md:hidden mt-8 sticky bottom-4 z-10">
 <button
 onClick={handleAddAllToCart}
 className="w-full bg-gradient-to-r from-[#3d7a3d] to-[#2d5a2d] text-white py-4 rounded-2xl font-bold text-lg shadow-2xl flex items-center justify-center gap-2"
 >
 <ShoppingCart className="w-5 h-5" />
 Add All {items.length} Items to Cart
 </button>
 </div>

 {/* Continue Shopping */}
 <div className="mt-12 text-center">
 <Link
 to="/shop"
 className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold hover:underline"
 >
 Continue Shopping
 <ArrowRight className="w-4 h-4" />
 </Link>
 </div>
 </div>
 </main>
 );
}
