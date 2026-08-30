/**
 * The JsBarcode call, ported verbatim from `ProductBarcode.jsx`.
 *
 * JsBarcode writes straight into an SVG element. It sets width/height but not
 * always a viewBox, and without one the symbol cannot be rescaled by CSS — which
 * the print label depends on, since that stylesheet sizes the symbol in
 * millimetres. So we backfill the viewBox after every render.
 *
 * No module-scope DOM access: the element is always passed in, by an effect or
 * by a click handler, so importing this during server rendering is inert.
 */

import JsBarcode from "jsbarcode";

import { BAR_COLOR } from "./symbology";
import type { BarcodeDrawOptions, BarcodeFormat } from "./types";

/**
 * Draws `barcode` into `svgElement`.
 *
 * Throws whatever JsBarcode throws for an invalid code — the caller decides
 * whether that is an error to show or a reason to skip a block of the label.
 */
export const drawBarcode = (
  svgElement: SVGSVGElement,
  barcode: string,
  format: BarcodeFormat,
  options: BarcodeDrawOptions = {},
): void => {
  JsBarcode(svgElement, barcode, {
    format,
    lineColor: BAR_COLOR,
    background: "#ffffff",
    displayValue: true,
    font: "monospace",
    fontSize: 16,
    textMargin: 2,
    margin: 10,
    ...options,
  });

  if (!svgElement.getAttribute("viewBox")) {
    const width = svgElement.getAttribute("width");
    const height = svgElement.getAttribute("height");
    if (width && height) {
      svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
  }
};
