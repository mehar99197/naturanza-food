/**
 * The printable label, ported from `printProductLabel` in `ProductBarcode.jsx`.
 *
 * It opens a blank window, writes a self-contained document into it and calls
 * `print()`. That is unchanged, including `document.write` — the label has to be
 * a separate document because `@page { margin: 0 }` and a millimetre-based
 * stylesheet cannot be scoped to a fragment of the app's own page.
 *
 * The product name is the only interpolated value that did not originate here,
 * and it is escaped. The two SVG fragments are markup this module and
 * `qrcode.react` produced, so they go in as-is.
 *
 * The brand line stays a literal rather than `SITE_NAME` from @/config/site.
 * That module documents itself as read during server rendering — it evaluates
 * `process.env.PUBLIC_SITE_URL`, which is not a `NEXT_PUBLIC_` variable and so
 * is stripped from the client bundle — and this file is reached from a Client
 * Component. Worth exposing the brand name from a client-safe module; noted for
 * the integrator rather than done here.
 */

import { drawBarcode } from "./drawBarcode";
import { PRINT_QR_MM, PRINT_SYMBOL_WIDTH_MM } from "./symbology";
import type { BarcodeFormat } from "./types";

const escapeHtml = (value: string | null | undefined): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * A dedicated print symbol: taller bars and a larger font, since the label draws
 * the digits itself at a controlled size below the bars.
 */
const renderPrintBarcodeBlock = (
  barcode: string,
  format: BarcodeFormat,
): string => {
  const printSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  drawBarcode(printSvg, barcode, format, {
    width: 3,
    height: 110,
    fontSize: 22,
    margin: 12,
  });
  printSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  return `
      <div class="code-block">
        <div class="caption">POS</div>
        <div class="barcode">${printSvg.outerHTML}</div>
        <div class="digits">${escapeHtml(barcode)}</div>
      </div>`;
};

export interface PrintLabelInput {
  productName: string;
  barcode: string | null;
  format: BarcodeFormat | null;
  /** The QR `<svg>` exactly as the on-screen preview rendered it, or "". */
  qrSvgOuterHtml: string;
}

export const printProductLabel = ({
  productName,
  barcode,
  format,
  qrSvgOuterHtml,
}: PrintLabelInput): void => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  // 1D barcode block — only when the product actually has a scannable code.
  const barcodeBlock =
    format && barcode ? renderPrintBarcodeBlock(barcode, format) : "";

  // QR block — a phone scan opens the product page directly. The SVG is the same
  // node the on-screen preview rendered, so the print matches the preview.
  const qrBlock = qrSvgOuterHtml
    ? `
      <div class="code-block">
        <div class="caption">Scan for product details</div>
        <div class="qr">${qrSvgOuterHtml}</div>
      </div>`
    : "";

  const safeProductName = escapeHtml(productName);
  const label = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Label - ${safeProductName}</title>
<style>
  @page { margin: 0; size: auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #fff;
  }
  .label {
    text-align: center;
    padding: 6mm;
  }
  .brand {
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #166534;
    margin-bottom: 2mm;
  }
  .product-name {
    font-size: 10pt;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 3mm;
    max-width: ${PRINT_SYMBOL_WIDTH_MM + PRINT_QR_MM + 12}mm;
  }
  .codes {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 6mm;
  }
  .code-block {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .caption {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 1.5mm;
  }
  /* Nominal-scale symbol — do not shrink this, or scanners start to miss it. */
  .barcode svg {
    display: block;
    width: ${PRINT_SYMBOL_WIDTH_MM}mm;
    height: auto;
  }
  .digits {
    font-family: monospace;
    font-size: 9pt;
    letter-spacing: 0.1em;
    color: #1f2937;
    margin-top: 1mm;
  }
  .qr svg {
    display: block;
    width: ${PRINT_QR_MM}mm;
    height: ${PRINT_QR_MM}mm;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="brand">NATURANZA FOOD</div>
    <div class="product-name">${safeProductName}</div>
    <div class="codes">${barcodeBlock}${qrBlock}</div>
  </div>
  <script>window.print();window.close();<\/script>
</body>
</html>`;

  printWindow.document.write(label);
  printWindow.document.close();
};
