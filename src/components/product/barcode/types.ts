/**
 * Types for the product barcode label.
 *
 * No directive and no imports with side effects: this module is pulled in by the
 * Client Component and by its helpers alike, and must stay safe to evaluate
 * during server rendering.
 */

/** The three symbologies the label supports, spelled as JsBarcode names them. */
export type BarcodeFormat = "EAN13" | "UPC" | "EAN8";

/**
 * What the label needs to know about a product.
 *
 * The Vite component took `productName`, `barcode` and `productUrl` as three
 * loose props, filled from `GET /api/admin/products/:id/barcode-data`. Bundling
 * them means a caller cannot pass a name from one product and a code from
 * another — which, on something that prints a scannable retail label, is a
 * mistake worth making impossible rather than merely unlikely.
 */
export interface BarcodeProduct {
  /** Printed on the label and slugified into the download filename. */
  name: string;
  /**
   * The retail code. `null` for a product that has never had one assigned —
   * the label still renders, with the QR half only.
   */
  barcode: string | null;
  /**
   * Absolute, public URL of the product page; what the QR code resolves to.
   * `null` suppresses the QR half and the "resolve" links below it.
   */
  productUrl: string | null;
}

/** The per-render JsBarcode settings that differ between preview and print. */
export interface BarcodeDrawOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  margin?: number;
}
