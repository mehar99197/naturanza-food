import Link from "next/link";

/** The "shop now" panel that closes an article, unchanged from BlogPost.jsx. */
export function BlogShopCta() {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
      <span className="text-3xl mb-3 block">🌿</span>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to try natural products?</h3>
      <p className="text-gray-500 mb-5 text-sm">
        Pure mountain honey and natural ispaghol husk — directly from trusted farms.
      </p>
      <Link
        href="/shop"
        className="inline-block bg-gradient-to-r from-emerald-500 to-green-600 text-white px-7 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all shadow-md shadow-green-500/20"
      >
        Shop Now
      </Link>
    </div>
  );
}
