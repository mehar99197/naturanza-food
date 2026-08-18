import Link from "next/link";
import { Package } from "lucide-react";

import { NotFoundProductId } from "@/components/productDetail/NotFoundProductId";

/**
 * Shown when `notFound()` fires — an unknown id, or one belonging to a product
 * that is inactive or soft-deleted.
 *
 * The wording and layout are the SPA's, with one thing it could not do: this
 * response carries a real 404 status. The SPA returned 200 with this markup, so
 * Google indexed withdrawn products as live pages.
 *
 * `<main>` became a `<div>` because the storefront layout already provides the
 * page's single `<main>` landmark.
 */
export default function ProductNotFound() {
  return (
    <div className="pt-24 pb-16 min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold text-[#2d3a2d] mb-4">Product Not Found</h1>
        <NotFoundProductId />
        <p className="text-gray-500 mb-6">This product does not exist or has been removed.</p>
        <Link
          href="/shop"
          className="inline-block px-6 py-3 bg-gradient-to-r from-[#3d7a3d] to-[#2d5a2d] text-white rounded-xl font-semibold hover:shadow-lg"
        >
          Back to Shop
        </Link>
      </div>
    </div>
  );
}
