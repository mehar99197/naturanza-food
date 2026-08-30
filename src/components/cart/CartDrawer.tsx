"use client";

/**
 * Slide-over cart, ported from frontend/src/components/CartDrawer.jsx.
 *
 * "use client" is unavoidable: the open/closed flag, every quantity mutation and
 * the body scroll-lock all live in the browser.
 *
 * Routing: react-router's `useNavigate` becomes `useRouter().push` from
 * next/navigation ("Continue Shopping" -> /shop), and the checkout `<Link to>`
 * becomes `next/link` inside CartDrawerFooter. Both URLs are unchanged.
 *
 * The line-item body and the footer live in sibling files — this one stays the
 * shell (overlay, header, list states) so the file keeps under the size ceiling.
 *
 * Two details worth preserving as-is:
 *
 *  - The scroll lock pads `document.body` by the scrollbar width it removes,
 *    otherwise the page behind visibly jumps sideways as the drawer opens.
 *    It restores the *previous* inline values rather than clearing them, so a
 *    second lock-owner (a modal) is not stomped on unmount.
 *  - `loading && items.length === 0` is a distinct state from an empty cart. The
 *    original refuses to show "Your cart feels light" while the first fetch is
 *    still in flight, which is what stops a full cart flashing "empty" on open.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ShoppingBag,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import { useCart } from "@/providers/CartProvider";
import { useSettings } from "@/providers/SettingsProvider";
import { computeStoreSaleDiscount } from "@/lib/utils";

import { CartDrawerFooter } from "./CartDrawerFooter";
import { CartLineItem } from "./CartLineItem";
import {
  getCategoryLabel,
  getImageSrc,
  getItemKey,
  getItemName,
  getProductId,
  getUnitPrice,
} from "./cartItemFields";

export function CartDrawer() {
  const router = useRouter();
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

  const normalizedTotalPrice = Number(totalPrice) || 0;
  // Store-wide sale: extra reduction beyond per-product discounts (already in totalPrice).
  const storeSaleDiscount = computeStoreSaleDiscount(items, settings);
  const discountedTotal = Math.max(0, normalizedTotalPrice - storeSaleDiscount);

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    router.push("/shop");
  };

  useEffect(() => {
    if (!isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
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
                const unitPrice = getUnitPrice(item, settings);
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const lineTotal = (Number(unitPrice) || 0) * quantity;

                return (
                  <CartLineItem
                    key={getItemKey(item, index)}
                    productId={productId}
                    itemName={itemName}
                    categoryLabel={getCategoryLabel(item)}
                    imageSrc={getImageSrc(item)}
                    unitPrice={unitPrice}
                    quantity={quantity}
                    lineTotal={lineTotal}
                    currency={settings.currency}
                    onRemove={removeFromCart}
                    onUpdateQuantity={updateQuantity}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <CartDrawerFooter
            totalItems={totalItems}
            currency={settings.currency}
            shippingFree={settings.shippingFree}
            storeDiscountLabel={settings.storeDiscountLabel}
            normalizedTotalPrice={normalizedTotalPrice}
            storeSaleDiscount={storeSaleDiscount}
            discountedTotal={discountedTotal}
            onClearCart={clearCart}
            onCheckoutNavigate={() => setIsCartOpen(false)}
          />
        )}
      </aside>
    </>
  );
}
