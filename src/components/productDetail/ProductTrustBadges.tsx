import { Check, Clock, Leaf, Shield, Truck } from "lucide-react";

/**
 * The reassurance rows at the foot of each buy panel.
 *
 * Both are fixed marketing copy — no product data reaches them — so they are
 * Server Components rendered as siblings of the interactive panel rather than
 * inside it, which keeps them out of the client bundle.
 *
 * The two rows say different things, which is why they are two components and
 * not one with a variant: the phone row promises delivery and checkout safety,
 * the desktop row lists product credentials. Preserved as found.
 */

/** Phone: Free Shipping / Safe Checkout / Fast Dispatch. */
export function ProductMobileTrustRow() {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
      <div className="text-center">
        <Truck className="mx-auto h-4 w-4 text-emerald-700" />
        <p className="mt-1 text-[11px] font-semibold text-gray-700">Free Shipping</p>
      </div>
      <div className="text-center">
        <Shield className="mx-auto h-4 w-4 text-emerald-700" />
        <p className="mt-1 text-[11px] font-semibold text-gray-700">Safe Checkout</p>
      </div>
      <div className="text-center">
        <Clock className="mx-auto h-4 w-4 text-emerald-700" />
        <p className="mt-1 text-[11px] font-semibold text-gray-700">Fast Dispatch</p>
      </div>
    </div>
  );
}

/** Desktop: 100% Organic / Cruelty-Free / Eco-Friendly / Fast Shipping. */
export function ProductDesktopBadgeRow() {
  return (
    <div className="mt-5 grid grid-cols-4 gap-3">
      <div className="flex items-center gap-2">
        <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-xs font-semibold text-gray-800 leading-tight">100% Organic</span>
      </div>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-xs font-semibold text-gray-800 leading-tight">Cruelty-Free</span>
      </div>
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-green-600 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-xs font-semibold text-gray-800 leading-tight">Eco-Friendly</span>
      </div>
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-gray-700 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-xs font-semibold text-gray-800 leading-tight">Fast Shipping</span>
      </div>
    </div>
  );
}
