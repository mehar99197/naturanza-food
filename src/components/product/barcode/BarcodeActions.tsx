/**
 * The download/print row under the two code previews, ported from
 * `ProductBarcode.jsx`.
 *
 * Its own file because the disabled rules are the interesting part and they are
 * all different: the barcode download needs a symbol that actually rendered, the
 * QR download needs a product URL, and print needs either one — it will happily
 * produce a QR-only label for a product with no retail code.
 */

import { Download, Printer } from "lucide-react";

export interface BarcodeActionsProps {
  /** True when the 1D symbol failed to render, or there is none to render. */
  hasRenderError: boolean;
  hasQr: boolean;
  hasFormat: boolean;
  onDownloadBarcode: () => void;
  onDownloadQr: () => void;
  onPrint: () => void;
}

const PRIMARY_BUTTON =
  "inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:pointer-events-none disabled:opacity-50";

export function BarcodeActions({
  hasRenderError,
  hasQr,
  hasFormat,
  onDownloadBarcode,
  onDownloadQr,
  onPrint,
}: BarcodeActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onDownloadBarcode}
        disabled={hasRenderError}
        className={PRIMARY_BUTTON}
      >
        <Download className="h-4 w-4" />
        Download Barcode
      </button>
      <button
        type="button"
        onClick={onDownloadQr}
        disabled={!hasQr}
        className={PRIMARY_BUTTON}
      >
        <Download className="h-4 w-4" />
        Download QR
      </button>
      <button
        type="button"
        onClick={onPrint}
        disabled={!hasFormat && !hasQr}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
      >
        <Printer className="h-4 w-4" />
        Print Label
      </button>
    </div>
  );
}
