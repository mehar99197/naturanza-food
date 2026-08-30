/**
 * The "Resolve EAN → Product → Google" footer, ported from `ProductBarcode.jsx`.
 *
 * Plain `<a target="_blank">` throughout, not `next/link`: two of the three are
 * google.com, and the third is the product's own *absolute* canonical URL opened
 * in a new tab — the point of the row is to prove the code resolves to a real
 * indexed page, which a client-side route transition would not demonstrate.
 *
 * The heading interpolates the barcode even when the product has none, in which
 * case it reads "Resolve EAN  → Product → Google". That is the original's
 * wording and the original's gap; the whole block is hidden unless there is a
 * product URL, so it only shows for a product that at least has a page.
 */

import { ExternalLink, Search, ShoppingBag } from "lucide-react";

import {
  buildGoogleShoppingUrl,
  buildGoogleSiteSearchUrl,
} from "./symbology";

export interface BarcodeResolveLinksProps {
  productUrl: string;
  barcode: string | null;
  hasFormat: boolean;
}

const LINK_CLASS =
  "inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50";

export function BarcodeResolveLinks({
  productUrl,
  barcode,
  hasFormat,
}: BarcodeResolveLinksProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-slate-100 pt-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Resolve EAN {barcode} → Product → Google
      </span>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          <ExternalLink className="h-4 w-4" />
          Open Product
        </a>
        <a
          href={buildGoogleSiteSearchUrl(productUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          <Search className="h-4 w-4" />
          Search Google
        </a>
        {hasFormat && barcode ? (
          <a
            href={buildGoogleShoppingUrl(barcode)}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            <ShoppingBag className="h-4 w-4" />
            Search Google Shopping
          </a>
        ) : null}
      </div>
    </div>
  );
}
