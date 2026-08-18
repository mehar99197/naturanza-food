"use client";

/**
 * The scannable-code panel for a product, ported from
 * `frontend/src/components/ProductBarcode.jsx`.
 *
 * Two codes side by side, for two different scanners: a 1D symbol a retail POS
 * laser reads, and a QR a phone camera reads that opens the product page. Both
 * render as `<svg>`, which is what makes the PNG export and the print label work
 * off the same nodes.
 *
 * "use client" IS LOAD-BEARING HERE, unlike most leaves. JsBarcode does not
 * return markup — it mutates an element in place — so the symbol cannot exist
 * until there is a DOM to mutate. Everything that touches `document` or `window`
 * (the effect, the PNG rasteriser, the print window) is inside a handler or an
 * effect; nothing at module scope in this file or its helpers reads either, so
 * importing it during server rendering is inert.
 *
 * PROPS CHANGED: the original took `productName`, `barcode` and `productUrl` as
 * three loose props. They are now one `BarcodeProduct` — see ./barcode/types for
 * why. Nothing else about the rendering changed.
 *
 * ONE DELIBERATE FIX, sanctioned by the assignment: the preview `<svg>` now
 * carries width and height attributes before JsBarcode fills it in. The original
 * rendered `<svg ref={svgRef} />`, which browsers size at a default 300x150
 * until the effect replaces it — a visible jump on every open. `reservePreviewSize`
 * computes the box the symbol will actually occupy. Nothing else about the draw
 * changed, and JsBarcode still overwrites both attributes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { BarcodeActions } from "./barcode/BarcodeActions";
import { BarcodeResolveLinks } from "./barcode/BarcodeResolveLinks";
import { downloadSvgAsPng } from "./barcode/downloadSvgAsPng";
import { drawBarcode } from "./barcode/drawBarcode";
import { printProductLabel } from "./barcode/printLabel";
import {
  BAR_COLOR,
  PREVIEW_BAR_WIDTH,
  PREVIEW_HEIGHT,
  QR_PREVIEW_SIZE,
  SYMBOLOGY_LABELS,
  reservePreviewSize,
  resolveFormat,
  toKebabCase,
} from "./barcode/symbology";
import type { BarcodeProduct } from "./barcode/types";

export type { BarcodeProduct } from "./barcode/types";

const NO_BARCODE_MESSAGE = "This product has no scannable barcode assigned yet.";
const INVALID_BARCODE_MESSAGE =
  "Barcode could not be rendered — the number looks invalid.";

export interface ProductBarcodeProps {
  product: BarcodeProduct;
}

export function ProductBarcode({ product }: ProductBarcodeProps) {
  const { name, barcode, productUrl } = product;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const format = resolveFormat(barcode);
  const baseFileName = `naturanza-${toKebabCase(name)}`;
  const reserved = reservePreviewSize(format);
  const hasQr = Boolean(productUrl);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    if (!format || !barcode) {
      setRenderError(NO_BARCODE_MESSAGE);
      return;
    }

    try {
      drawBarcode(svgElement, barcode, format, {
        width: PREVIEW_BAR_WIDTH,
        height: PREVIEW_HEIGHT,
      });
      setRenderError(null);
    } catch {
      setRenderError(INVALID_BARCODE_MESSAGE);
    }
  }, [barcode, format]);

  const getQrSvg = useCallback(
    (): SVGSVGElement | null => qrWrapperRef.current?.querySelector("svg") ?? null,
    [],
  );

  const handleDownloadBarcode = useCallback(() => {
    if (svgRef.current && !renderError) {
      void downloadSvgAsPng(svgRef.current, `${baseFileName}-barcode.png`);
    }
  }, [baseFileName, renderError]);

  const handleDownloadQr = useCallback(() => {
    const qrSvg = getQrSvg();
    if (qrSvg) {
      void downloadSvgAsPng(qrSvg, `${baseFileName}-qr.png`);
    }
  }, [baseFileName, getQrSvg]);

  const handlePrint = useCallback(() => {
    const qrSvg = getQrSvg();
    const qrSvgOuterHtml = qrSvg ? qrSvg.outerHTML : "";
    if (!format && !qrSvgOuterHtml) return;

    printProductLabel({ productName: name, barcode, format, qrSvgOuterHtml });
  }, [barcode, format, getQrSvg, name]);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {/* 1D barcode — read by retail POS / laser scanners */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            POS Barcode
          </span>
          <div className="inline-flex max-w-full overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,64,28,0.1)]">
            <svg ref={svgRef} width={reserved.width} height={reserved.height} />
          </div>
          {renderError ? (
            <p className="max-w-[280px] text-center text-sm font-medium text-amber-600">
              {renderError}
            </p>
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {format ? SYMBOLOGY_LABELS[format] : ""} · {barcode}
            </p>
          )}
        </div>

        {/* QR code — a phone scan opens the product page directly */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Scan for Product
          </span>
          <div
            ref={qrWrapperRef}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,64,28,0.1)]"
          >
            {productUrl ? (
              <QRCodeSVG
                value={productUrl}
                size={QR_PREVIEW_SIZE}
                bgColor="#ffffff"
                fgColor={BAR_COLOR}
                level="M"
                marginSize={2}
              />
            ) : (
              <p className="max-w-[120px] text-center text-sm font-medium text-amber-600">
                Product URL unavailable.
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="max-w-[260px] text-sm font-semibold text-slate-800 line-clamp-2">
              {name}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Scan to view product
            </p>
          </div>
        </div>
      </div>

      <BarcodeActions
        hasRenderError={Boolean(renderError)}
        hasQr={hasQr}
        hasFormat={Boolean(format)}
        onDownloadBarcode={handleDownloadBarcode}
        onDownloadQr={handleDownloadQr}
        onPrint={handlePrint}
      />

      {productUrl ? (
        <BarcodeResolveLinks
          productUrl={productUrl}
          barcode={barcode}
          hasFormat={Boolean(format)}
        />
      ) : null}
    </div>
  );
}

export default ProductBarcode;
