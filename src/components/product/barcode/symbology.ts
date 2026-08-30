/**
 * Symbology rules and label sizing, ported from the top of
 * `frontend/src/components/ProductBarcode.jsx`.
 *
 * The two sets of dimensions below are separate on purpose, and the original's
 * comment explaining why is worth keeping in front of anyone editing them: the
 * preview is sized in pixels for a screen, the print label in millimetres,
 * because a scanner only reads a 1D symbol reliably at or near nominal scale.
 * Shrinking the print sizes to make a label fit is how you ship a code that the
 * shop's till cannot read.
 */

import type { BarcodeFormat } from "./types";

/** On-screen preview sizing. */
export const PREVIEW_BAR_WIDTH = 2;
export const PREVIEW_HEIGHT = 70;
export const BAR_COLOR = "#111827";
export const QR_PREVIEW_SIZE = 120;

/** JsBarcode preview defaults that also feed the reserved-size calculation. */
export const PREVIEW_MARGIN = 10;
export const PREVIEW_FONT_SIZE = 16;
export const PREVIEW_TEXT_MARGIN = 2;

/**
 * Nominal EAN-13 symbol is 37.29mm x 25.93mm at 100% magnification (GS1).
 * Printing at nominal size is what keeps the label readable on cheap POS
 * scanners, so the print stylesheet works in mm rather than px.
 */
export const PRINT_SYMBOL_WIDTH_MM = 37.29;

/** QR printed at ~26mm keeps it comfortably inside any phone camera's scan area. */
export const PRINT_QR_MM = 26;

export const SYMBOLOGY_LABELS: Record<BarcodeFormat, string> = {
  EAN13: "EAN-13",
  UPC: "UPC-A",
  EAN8: "EAN-8",
};

/**
 * Which symbology a code is, inferred from its length alone — unchanged from the
 * original. Note that it does not check the digits: a 13-character code that is
 * not numeric is still called EAN13 here, and JsBarcode throws on it, which the
 * component catches and reports as "the number looks invalid".
 */
export const resolveFormat = (
  barcode: string | null | undefined,
): BarcodeFormat | null => {
  const length = String(barcode || "").length;
  if (length === 13) return "EAN13";
  if (length === 12) return "UPC";
  if (length === 8) return "EAN8";
  return null;
};

/**
 * Total module count JsBarcode emits per symbology, guard bars and the text
 * columns included.
 *
 * EAN-13 is 95 modules of symbol plus a 12-module column that carries the
 * leading digit outside the bars; UPC-A is 95 plus a column at each end; EAN-8
 * is 67 with its text centred underneath and no side columns. These feed the
 * reserved size below — they are not used to draw anything.
 */
const MODULE_COUNTS: Record<BarcodeFormat, number> = {
  EAN13: 107,
  UPC: 111,
  EAN8: 67,
};

export interface ReservedSize {
  width: number;
  height: number;
}

/**
 * The box to reserve for the preview `<svg>` before JsBarcode fills it in.
 *
 * An `<svg>` with no width or height is a replaced element with a 300x150
 * default intrinsic size, so the original rendered a 300x150 placeholder and
 * then snapped to roughly 234x108 once the effect ran — a visible jump on every
 * load. Setting these up front removes it. JsBarcode overwrites both attributes
 * with its own exact numbers on first paint, so a few pixels of error in the
 * width estimate costs nothing; the height, which is what reflows the page, is
 * exact: bar height + font + text margin + top and bottom margins.
 */
export const reservePreviewSize = (
  format: BarcodeFormat | null,
): ReservedSize => ({
  width: MODULE_COUNTS[format ?? "EAN13"] * PREVIEW_BAR_WIDTH + PREVIEW_MARGIN * 2,
  height:
    PREVIEW_HEIGHT +
    PREVIEW_FONT_SIZE +
    PREVIEW_TEXT_MARGIN +
    PREVIEW_MARGIN * 2,
});

/** Slug for the download filename; "product" when nothing usable is left. */
export const toKebabCase = (value: string | null | undefined): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "product";

/**
 * Deep links into Google's own search UI — never scrapes or predicts results,
 * just pre-fills a query that should surface this product once Google has
 * indexed its canonical page (see backend/utils/seoRenderer.js).
 */
export const buildGoogleSiteSearchUrl = (url: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:naturanzafood.com "${url}"`)}`;

export const buildGoogleShoppingUrl = (code: string): string =>
  `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(code)}`;
