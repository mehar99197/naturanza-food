import Link from "next/link";
import { ShoppingBag } from "lucide-react";

/**
 * What `notFound()` renders for a category slug that does not exist.
 *
 * It borrows the shop's own empty-state panel — the same icon, copy weight and
 * button — so the page reads as part of the shop rather than as a generic error
 * screen. The difference from the SPA is the status line, not the pixels: this
 * is served with a real 404, where every unknown slug used to answer 200 with
 * an empty grid.
 */
export default function ShopCategoryNotFound() {
  return (
    <main className="shop-mobile-shell pt-24 pb-12 sm:pb-16 min-h-screen bg-green-50 overflow-x-hidden">
      <div className="container-custom">
        <div className="text-center py-12 sm:py-16 bg-white rounded-xl shadow-sm">
          <div className="max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-[#2d3a2d] text-lg font-semibold mb-2">
              Category not found
            </p>
            <p className="text-[#6b7a6b] mb-6">
              That category is no longer available. Browse the full range instead.
            </p>
            <Link
              href="/shop"
              className="inline-block px-6 py-3 bg-[#3d7a3d] text-white rounded-xl font-medium hover:bg-[#2d5a2d] shadow-md"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
