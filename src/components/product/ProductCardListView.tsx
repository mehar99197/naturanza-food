"use client";

/**
 * The `viewMode="list"` branch of ProductCard, split out so ProductCard.tsx stays
 * under the file-size ceiling. Markup is byte-identical to the original branch in
 * frontend/src/components/ProductCard.jsx.
 *
 * Presentational only: every value it renders and both handlers are computed by
 * ProductCard, which owns the context reads. Splitting it this way keeps a single
 * copy of the cart/wishlist/auth logic for both layouts.
 *
 * Routing: two react-router `<Link to>` become `next/link` `<Link href>` at the
 * same `/product/:id` URL.
 */

import type { MouseEvent } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { motion } from "framer-motion";

import { buttonTap } from "@/lib/animations";
import { OptimizedImage } from "@/components/OptimizedImage";
import { formatPrice } from "@/lib/utils";
import type { ProductPricing } from "@/lib/pricing";

import { LOCAL_CARD_IMAGES } from "./productCardImage";
import type { ProductCardProduct } from "./types";

/** Five fixed slots, so the star row is a plain map rather than `[...Array(5)]`. */
const STAR_SLOTS = [0, 1, 2, 3, 4];

export interface ProductCardListViewProps {
  product: ProductCardProduct;
  productId: string | number | null | undefined;
  cardImage: string;
  pricing: ProductPricing;
  currency: string;
  /** Rating rounded to a whole number of filled stars. */
  filledStars: number;
  reviewCount: number;
  isWishlisted: boolean;
  isWishlistUpdating: boolean;
  onAddToCart: (event: MouseEvent<HTMLButtonElement>) => void;
  onWishlistToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function ProductCardListView({
  product,
  productId,
  cardImage,
  pricing,
  currency,
  filledStars,
  reviewCount,
  isWishlisted,
  isWishlistUpdating,
  onAddToCart,
  onWishlistToggle,
}: ProductCardListViewProps) {
  return (
    <div className="shop-product-card bg-white/95 border border-green-100 rounded-2xl overflow-hidden shadow-sm transition-shadow duration-300 ease-out hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
    >
      <div className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3">
        <Link href={`/product/${productId}`} className="block w-24 h-20 sm:w-32 sm:h-24 flex-shrink-0">
          <div className="shop-card-image relative w-full h-full bg-white rounded-xl overflow-hidden flex items-center justify-center p-2">
            <motion.button
              onClick={onWishlistToggle}
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
              fallbackSrc={LOCAL_CARD_IMAGES.default}
              alt={product.name ?? ''}
              imgClassName="block w-full h-full max-w-full max-h-full object-contain object-center"
              wrapperClassName="block w-full h-full"
            />
          </div>
        </Link>

        <div className="shop-card-content min-w-0 flex-1">
          <div className="flex items-center gap-1 text-yellow-400 mb-1">
            {STAR_SLOTS.map((index) => (
              <Star
                key={index}
                className={`w-3.5 h-3.5 ${index < filledStars ? 'fill-current text-yellow-400' : 'text-gray-300'}`}
              />
            ))}
            <span className="ml-1 text-xs text-gray-500">({reviewCount})</span>
          </div>

          <Link href={`/product/${productId}`}>
            <h3 className="font-semibold text-sm text-gray-800 leading-snug truncate md:line-clamp-2 lg:line-clamp-1 break-words mb-1">{product.name}</h3>
          </Link>

          <p className="text-sm text-gray-500 leading-snug truncate md:line-clamp-2 lg:line-clamp-1 break-words mb-2">{product.description}</p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
                {formatPrice(pricing.salePrice, currency)}
              </span>
              {pricing.onSale && (
                <>
                  <span className="text-xs text-gray-400 line-through whitespace-nowrap">
                    {formatPrice(pricing.base, currency)}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 rounded px-1 py-0.5 whitespace-nowrap">
                    {pricing.effectivePct}% OFF
                  </span>
                </>
              )}
            </div>

            <motion.button
              onClick={onAddToCart}
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
