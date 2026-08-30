import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProductCard } from "@/components/product/ProductCard";
import type { ProductWithCategory } from "@/types/catalog";

import { AutoScrollTrack } from "./CarouselTrack";
import { FeaturedProductsEmpty } from "./FeaturedProductsEmpty";
import { Reveal } from "./Reveal";

/**
 * "Featured Products" — ported from frontend/src/sections/FeaturedProducts.jsx.
 *
 * A Server Component. The source read the list out of ProductContext, which
 * fetched the whole catalog from the browser after mount, so the first paint of
 * the home page had an empty rail and the largest contentful element arrived one
 * round trip late. The rows are queried on the server here and the cards ship in
 * the initial HTML; `ProductCard` is still a Client Component for its cart and
 * wishlist buttons, but it server-renders like any other.
 *
 * The cards are `animate-fade-in-up opacity-0` with a per-card delay — a CSS
 * animation, not JavaScript, so it runs on the server-rendered markup unchanged.
 */
export function FeaturedProducts({ products }: { products: ProductWithCategory[] }) {
  return (
    <section className="featured-mobile-shell py-8 sm:py-10 md:py-12 lg:py-14 bg-gradient-to-b from-white via-green-50/30 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="hidden sm:block absolute inset-0 bg-[linear-gradient(rgba(61,122,61,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(61,122,61,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="w-full max-w-screen-2xl mx-auto px-2.5 xs:px-3.5 sm:px-4 md:px-5 lg:px-6 relative z-10">
        <Reveal className="text-center mb-7 sm:mb-10 md:mb-12 lg:mb-14 reveal reveal-left">
          <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-2 md:mb-3 px-3 py-1 md:px-4 md:py-1.5 bg-green-600 rounded-full shadow-md animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">Featured Collection</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2.5 md:mb-3.5 lg:mb-4 text-gray-900 animate-fade-in-up opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards]">
            <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">Featured Products</span>
          </h2>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto px-1 sm:px-4 md:px-0 animate-fade-in-up opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
            Explore our handpicked selection of premium organic products
          </p>
        </Reveal>

        {/* Single horizontal row with controlled auto-scroll */}
        {products.length === 0 ? (
          <FeaturedProductsEmpty />
        ) : (
          <AutoScrollTrack
            itemCount={products.length}
            className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 lg:gap-6 px-0 py-1.5 sm:py-2 md:py-1 mb-10 sm:mb-12 md:mb-14 lg:mb-16 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
          >
            {products.map((product, index) => (
              <div
                key={product.id}
                className="featured-mobile-card snap-center flex-shrink-0 py-1 w-full min-w-full md:w-auto md:min-w-0 rounded-2xl animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <ProductCard product={product} viewMode="grid" />
              </div>
            ))}
          </AutoScrollTrack>
        )}

        <div className="text-center">
          <Link
            href="/shop"
            className="btn-3d inline-flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl font-semibold text-sm shadow-3d md:hover:shadow-3d-hover md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
          >
            View All Products
            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
