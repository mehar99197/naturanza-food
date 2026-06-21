import {
 X,
 Plus,
 Minus,
 ShoppingBag,
 Trash2,
 ArrowRight,
 Truck,
 ShieldCheck,
 AlertCircle,
 LoaderCircle,
} from 'lucide-react';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice, getProductPricing, computeStoreSaleDiscount } from '@/lib/utils';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { Link, useNavigate } from 'react-router-dom';

export function CartDrawer() {
 const navigate = useNavigate();
 const {
 items,
 isCartOpen,
 setIsCartOpen,
 removeFromCart,
 updateQuantity,
 totalPrice,
 clearCart,
 totalItems,
 loading,
 error,
 } = useCart();
 const { settings } = useSettings();

 const getProductId = (item) => item.product_id ?? item.id;
 const getImageSrc = (item) => {
  const imageValue = item.image_url || item.image || '';
    if (!imageValue) return '/images/products/honey.webp';
  // Use getAbsoluteImageUrl to convert relative URLs to absolute backend URLs
  return getAbsoluteImageUrl(imageValue, { defaultFolder: 'products' });
 };
 const getUnitPrice = (item) => {
 const pricing = getProductPricing(item, settings);
 return pricing.onSale ? pricing.salePrice : (item.final_price ?? item.price);
 };
 const getItemName = (item) => item.name || item.product_name || 'Product';
 const getCategoryLabel = (item) => item.category_name || item.category || 'Naturanza Essentials';
 const getItemKey = (item, index) => {
 const productId = getProductId(item);
 const cartLineId = item.cart_item_id ?? item.cart_id ?? item.cartItemId ?? item.id;
 const variantId = item.variant_id ?? item.variantId ?? 'default';
 return `${cartLineId ?? productId ?? 'cart'}-${variantId}-${index}`;
 };

 const normalizedTotalPrice = Number(totalPrice) || 0;
 // Store-wide sale: extra reduction beyond per-product discounts (already in totalPrice).
 const storeSaleDiscount = computeStoreSaleDiscount(items, settings);
 const discountedTotal = Math.max(0, normalizedTotalPrice - storeSaleDiscount);

 const handleImageError = (event) => {
 event.currentTarget.src = '/images/products/honey.webp';
 };

 const handleContinueShopping = () => {
 setIsCartOpen(false);
 navigate('/shop');
 };

 useEffect(() => {
 if (!isCartOpen) return;

 const previousOverflow = document.body.style.overflow;
 const previousPaddingRight = document.body.style.paddingRight;
 const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

 document.body.style.overflow = 'hidden';
 if (scrollbarWidth > 0) {
 document.body.style.paddingRight = `${scrollbarWidth}px`;
 }

 return () => {
 document.body.style.overflow = previousOverflow;
 document.body.style.paddingRight = previousPaddingRight;
 };
 }, [isCartOpen]);

 if (!isCartOpen) return null;

 return (
 <>
 {/* Overlay */}
 <div
 className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px]"
 onClick={() => setIsCartOpen(false)}
 />

 {/* Drawer */}
 <aside
 role="dialog"
 aria-modal="true"
 aria-label="Shopping cart"
 className="fixed inset-y-0 right-0 z-[60] h-full w-full max-w-[90vw] sm:max-w-[430px] overflow-hidden border-l border-white/40 bg-[radial-gradient(circle_at_top,#f0fdf4_0%,#ffffff_40%,#f8fafc_100%)] shadow-[0_32px_80px_rgba(15,23,42,0.38)] flex flex-col"
 >
 {/* Header */}
 <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 px-4 pb-3.5 pt-4 backdrop-blur-xl sm:px-6 sm:pb-4 sm:pt-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5 sm:gap-3">
 <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25">
 <ShoppingBag className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
 </div>
 <div>
 <h2 className="font-display text-[1.95rem] sm:text-[1.45rem] font-bold tracking-tight leading-tight text-slate-800">Your Cart</h2>
 <p className="text-[11px] font-medium text-slate-500">Fresh picks, ready when you are</p>
 </div>
 </div>
 <button
 onClick={() => setIsCartOpen(false)}
 className="rounded-xl border border-slate-200/90 bg-white p-1.5 sm:p-2 text-slate-600 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
 aria-label="Close cart"
 >
 <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
 </button>
 </div>

 {error && (
 <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
 <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
 <span>{error}</span>
 </div>
 )}

 <div className="mt-2.5 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
 <span className="h-2 w-2 rounded-full bg-emerald-500" />
 {totalItems} item{totalItems === 1 ? '' : 's'} in cart
 </div>
 </div>

 {/* Cart Items */}
 <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-3.5 sm:px-6 sm:pb-6 sm:pt-4">
 {loading && items.length === 0 ? (
 <div className="flex h-full flex-col items-center justify-center text-center">
 <LoaderCircle className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
 <p className="text-sm font-medium text-slate-600">Refreshing your cart...</p>
 </div>
 ) : items.length === 0 ? (
 <div className="flex h-full flex-col items-center justify-center text-center">
 <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-100 to-green-50">
 <ShoppingBag className="h-9 w-9 text-emerald-600" />
 </div>
 <h3 className="font-display text-xl font-bold text-slate-700">Your cart feels light</h3>
 <p className="mb-6 mt-2 max-w-[260px] text-sm leading-relaxed text-slate-500">
 Pick your favorite Naturanza products and we will keep them ready here.
 </p>
 <button
 onClick={handleContinueShopping}
 className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
 >
 Continue Shopping
 </button>
 </div>
 ) : (
 <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-70' : 'opacity-100'}`}>
 {items.map((item, index) => {
 const productId = getProductId(item);
 const itemName = getItemName(item);
 const unitPrice = getUnitPrice(item);
 const quantity = Math.max(1, Number(item.quantity) || 1);
 const lineTotal = (Number(unitPrice) || 0) * quantity;

 return (
 <article
 key={getItemKey(item, index)}
 className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/85 p-2.5 sm:p-3.5 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/40"
 >
 <div className="pointer-events-none absolute -right-8 -top-8 hidden h-16 w-16 rounded-full bg-emerald-100/40 blur-xl sm:block" />
 <div className="flex gap-2.5 sm:gap-3">
 <div className="h-[72px] w-[72px] sm:h-[84px] sm:w-[84px] shrink-0 overflow-hidden rounded-lg sm:rounded-xl border border-slate-100 bg-slate-50">
 <img
 src={getImageSrc(item)}
 alt={itemName}
 onError={handleImageError}
 className="h-full w-full object-contain p-1.5 sm:p-2"
 loading="lazy"
 />
 </div>

 <div className="min-w-0 flex-1">
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="mb-0.5 line-clamp-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-emerald-700/90">
 {getCategoryLabel(item)}
 </p>
 <h4 className="line-clamp-2 text-[15px] sm:text-sm font-semibold leading-snug text-slate-800">{itemName}</h4>
 </div>
 <button
 onClick={() => removeFromCart(productId)}
 className="inline-flex h-7 w-7 sm:h-auto sm:w-auto items-center justify-center rounded-lg border border-rose-100 p-0 sm:p-1.5 text-rose-500 transition-colors duration-200 hover:bg-rose-50"
 aria-label={`Remove ${itemName} from cart`}
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>

 <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
 <p className="text-base font-bold text-emerald-700">
 {formatPrice(unitPrice, settings.currency)}
 </p>
 <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
 Total: {formatPrice(lineTotal, settings.currency)}
 </p>
 </div>

 <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2">
 <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50/80 p-0.5 sm:p-1">
 <button
 onClick={() => updateQuantity(productId, quantity - 1)}
 className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition-colors duration-200 hover:bg-white hover:text-slate-800"
 aria-label={`Decrease quantity for ${itemName}`}
 >
 <Minus className="h-3.5 w-3.5" />
 </button>
 <span className="min-w-[28px] text-center text-sm font-semibold text-slate-800">{quantity}</span>
 <button
 onClick={() => updateQuantity(productId, quantity + 1)}
 className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-700"
 aria-label={`Increase quantity for ${itemName}`}
 >
 <Plus className="h-3.5 w-3.5" />
 </button>
 </div>

 <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-600">
 Qty {quantity}
 </span>
 </div>
 </div>
 </div>
 </article>
 );
 })}
 </div>
 )}
 </div>

 {/* Footer */}
 {items.length > 0 && (
 <div className="shrink-0 border-t border-slate-200/80 bg-white/92 p-4 backdrop-blur-xl sm:p-6">
 {/* Free shipping progress — advance payment only (not COD) */}
 {(() => {
   const threshold = Number(settings.shippingFree) || 5000;
   const remaining = Math.max(0, threshold - discountedTotal);
   const pct = Math.min(100, (discountedTotal / threshold) * 100);
   const qualified = remaining === 0;
   return (
     <div className="mb-3.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2.5">
       {qualified ? (
         <p className="text-[12px] font-semibold text-emerald-700 text-center">
           🎉 Free delivery unlocked for advance payments!
         </p>
       ) : (
         <>
           <p className="mb-1.5 text-[11px] text-slate-500">
             Add <span className="font-bold text-emerald-700">{formatPrice(remaining, settings.currency)}</span> more for <span className="font-semibold text-emerald-700">free delivery</span>{' '}
             <span className="text-slate-400">(advance payment)</span>
           </p>
           <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
             <div
               className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
               style={{ width: `${pct}%` }}
             />
           </div>
         </>
       )}
     </div>
   );
 })()}
 <div className="mb-3.5 rounded-xl sm:rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-white via-emerald-50/50 to-green-50/70 px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-sm">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Order Total</p>
 <p className="mt-1 text-xs font-semibold text-emerald-700">
 {totalItems} item{totalItems === 1 ? '' : 's'} ready for checkout
 </p>
 </div>
 <div className="text-right">
 {storeSaleDiscount > 0 && (
 <p className="text-xs text-slate-400 line-through">
 {formatPrice(normalizedTotalPrice, settings.currency)}
 </p>
 )}
 <p className="font-display text-xl font-bold text-slate-800">
 {formatPrice(discountedTotal, settings.currency)}
 </p>
 </div>
 </div>
 {storeSaleDiscount > 0 && (
 <p className="mt-2 text-center text-[11px] font-semibold text-rose-600">
 🎉 {settings.storeDiscountLabel}: you save {formatPrice(storeSaleDiscount, settings.currency)}
 </p>
 )}
 </div>

 <div className="mb-3.5 flex items-center gap-2 text-[11px] text-slate-500">
 <ShieldCheck className="h-4 w-4 text-emerald-600" />
 <span>Secure checkout with protected payments.</span>
 <Truck className="h-4 w-4 text-emerald-600" />
 </div>

 <div className="mt-1 grid grid-cols-[2fr_3fr] items-center gap-2 sm:flex sm:items-center sm:justify-between">
 <button
 onClick={clearCart}
 className="inline-flex min-h-[40px] w-full sm:w-auto sm:flex-none items-center justify-center rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50/70 px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-100/80"
 >
 Clear Cart
 </button>

 <Link
 to="/checkout"
 onClick={() => setIsCartOpen(false)}
 className="inline-flex min-h-[40px] w-full sm:w-auto sm:flex-1 items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
 >
 Proceed to Checkout
 <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
 </Link>
 </div>
 </div>
 )}
 </aside>
 </>
 );
}
