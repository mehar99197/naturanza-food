"use client";

/**
 * Product card, ported from frontend/src/components/ProductCard.jsx. Rendered by
 * Shop, Home and the product page, so treat its markup as load-bearing.
 *
 * "use client": it reads four contexts (cart, settings, auth, wishlist) and owns
 * two async click handlers.
 *
 * PROP TYPING — see ./types.ts for the full reasoning. In short: `product` is a
 * structural interface declaring *both* casings, not a union, because Server
 * Components hand it the mapped `Product`/`ProductWithCategory` (camelCase) while
 * Client Components hand it a raw API row (snake_case). `getProductPricing`
 * already reads both discount spellings; the image resolver now reads both image
 * spellings for the same reason.
 *
 * Routing changes:
 *   `<Link to>`      -> next/link `<Link href>`, same /product/:id URLs.
 *   `useNavigate()`  -> `useRouter()` from next/navigation.
 *   The sign-in redirect carried `state: { from: { pathname: '/shop' } }`, which
 *   the App Router has no equivalent for; `loginUrlFor('/shop')` encodes the same
 *   destination as `?returnTo=%2Fshop`. The literal '/shop' is preserved from the
 *   original — the card sends you back to the shop, not to the page you were on.
 *
 * `viewMode="list"` renders ProductCardListView; everything above the branch is
 * shared so there is one copy of the cart/wishlist logic.
 */

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { motion } from "framer-motion";

import { useCart } from "@/providers/CartProvider";
import { useSettings } from "@/providers/SettingsProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useWishlist } from "@/providers/WishlistProvider";
import { formatPrice, getProductPricing } from "@/lib/utils";
import { buttonTap } from "@/lib/animations";
import { OptimizedImage } from "@/components/OptimizedImage";
import { loginUrlFor } from "@/lib/returnTo";

import { LOCAL_CARD_IMAGES, resolveCardImage } from "./productCardImage";
import { ProductCardListView } from "./ProductCardListView";
import type { ProductCardProduct, ProductCardViewMode } from "./types";

/** Five fixed slots, so the star row is a plain map rather than `[...Array(5)]`. */
const STAR_SLOTS = [0, 1, 2, 3, 4];

/** Where the card sends a signed-out visitor before adding to cart/wishlist. */
const SIGN_IN_RETURN_PATH = "/shop";

const badgeColors: Record<string, string> = {
  Bestseller: 'bg-orange-500',
  Featured: 'bg-orange-500',
  New: 'bg-blue-500',
  Sale: 'bg-red-500',
};

/**
 * Tint behind the product photo, picked from the id so a given product always
 * gets the same one. Purely decorative.
 */
const imageBgColors = [
  'bg-green-50', 'bg-purple-50', 'bg-orange-50', 'bg-cyan-50',
  'bg-yellow-50', 'bg-lime-50', 'bg-pink-50', 'bg-blue-50',
];

export interface ProductCardProps {
  product: ProductCardProduct;
  viewMode?: ProductCardViewMode;
  /** Tighter paddings and smaller type, for the denser carousels on Home. */
  compact?: boolean;
}

export function ProductCard({ product, viewMode = 'grid', compact = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { settings } = useSettings();
  const { isAuthenticated } = useAuth();
  const { isInWishlist, isUpdating, toggleWishlist } = useWishlist();
  const router = useRouter();
  const isListView = viewMode === 'list';
  const productId = product?.id ?? product?.product_id;
  const isWishlisted = isInWishlist(productId);
  const isWishlistUpdating = isUpdating(productId);
  const pricing = getProductPricing(product, settings);

  const handleAddToCart = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(loginUrlFor(SIGN_IN_RETURN_PATH));
      return;
    }
    await addToCart(product);
  };

  const handleWishlistToggle = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push(loginUrlFor(SIGN_IN_RETURN_PATH));
      return;
    }

    if (!productId || isWishlistUpdating) {
      return;
    }

    // Both id spellings are sent because the wishlist API and the local
    // optimistic update read different ones.
    await toggleWishlist({
      ...product,
      id: productId,
      product_id: productId,
    });
  };

  const effectiveReviewCount = Number(product.review_count ?? product.reviewCount ?? 0);
  const effectiveRating = Number(product.average_rating ?? product.averageRating ?? product.rating ?? 0);
  const filledStars = Math.round(effectiveRating);
  const cardImage = resolveCardImage(product);

  if (isListView) {
    return (
      <ProductCardListView
        product={product}
        productId={productId}
        cardImage={cardImage}
        pricing={pricing}
        currency={settings.currency}
        filledStars={filledStars}
        reviewCount={effectiveReviewCount}
        isWishlisted={isWishlisted}
        isWishlistUpdating={isWishlistUpdating}
        onAddToCart={handleAddToCart}
        onWishlistToggle={handleWishlistToggle}
      />
    );
  }

  // The modulo can never fall off the end; the `??` is only there to satisfy
  // noUncheckedIndexedAccess, and repeats index 0.
  const bgColor =
    imageBgColors[(parseInt(String(productId)) || 0) % imageBgColors.length] ?? 'bg-green-50';

  return (
    <div className="shop-product-card bg-white rounded-xl overflow-hidden h-full min-w-0 flex flex-col shadow-sm border border-gray-100 transition-shadow duration-300 ease-out hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
    >
      <Link href={`/product/${productId}`} className="block">
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
              fallbackSrc={LOCAL_CARD_IMAGES.default}
              alt={product.name ?? ''}
              imgClassName="block w-full h-full max-w-full max-h-full object-contain object-center"
              wrapperClassName="block w-full h-full"
            />
          </div>
        </div>
      </Link>

      <div className={`shop-card-content flex flex-col flex-1 ${compact ? 'p-2' : 'p-3 sm:p-3.5'}`}>
        {/* Badge category pill */}
        <span className="inline-block bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full mb-1 w-fit">
          {product.category_name || product.categoryName || product.category || 'Herbal'}
        </span>

        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-gray-800 leading-tight mb-0.5 text-sm line-clamp-1">{product.name}</h3>
        </Link>

        {/* Stars - moved up, removed description */}
        <div className="flex items-center gap-1 mb-1.5">
          {STAR_SLOTS.map((index) => (
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
