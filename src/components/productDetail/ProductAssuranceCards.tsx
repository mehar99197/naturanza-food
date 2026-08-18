import { Award, Leaf } from "lucide-react";

/**
 * The pair of cards under the desktop gallery — "100% Organic / Certified
 * Natural" and "Premium Quality / Batch Tested".
 *
 * Fixed copy, no product data, so it stays on the server.
 */
export function ProductAssuranceCards() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">100% Organic</p>
            <p className="text-xs text-gray-500">Certified Natural</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Premium Quality</p>
            <p className="text-xs text-gray-500">Batch Tested</p>
          </div>
        </div>
      </div>
    </div>
  );
}
