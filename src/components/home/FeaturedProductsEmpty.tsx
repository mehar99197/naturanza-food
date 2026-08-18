import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Shown when the catalog has nothing to feature.
 *
 * Reachable far less often than it looks: the page falls back to the newest
 * active products when nothing is flagged featured, so this only appears when
 * the storefront has no visible products at all.
 */
export function FeaturedProductsEmpty() {
  return (
    <div className="text-center py-16 mb-8">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Featured Products Available</h3>
      <p className="text-sm text-gray-600 mb-6">Check back soon for new arrivals and special offers</p>
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800"
      >
        Browse All Products
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
