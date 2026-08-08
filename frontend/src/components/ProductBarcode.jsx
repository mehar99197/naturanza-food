import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer } from "lucide-react";

// On-screen preview sizing. Print sizing is defined separately in millimetres
// below, because a scanner only reads reliably at (or near) nominal scale.
const PREVIEW_BAR_WIDTH = 2;
const PREVIEW_HEIGHT = 70;
const BAR_COLOR = "#111827";
const QR_PREVIEW_SIZE = 120;

// Nominal EAN-13 symbol is 37.29mm x 25.93mm at 100% magnification (GS1).
// Printing at nominal size is what keeps the label readable on cheap POS
// scanners, so the print stylesheet works in mm rather than px.
const PRINT_SYMBOL_WIDTH_MM = 37.29;
// QR printed at ~26mm keeps it comfortably inside any phone camera's scan area.
const PRINT_QR_MM = 26;

const SYMBOLOGY_LABELS = {
  EAN13: "EAN-13",
  UPC: "UPC-A",
  EAN8: "EAN-8",
};

const resolveFormat = (barcode) => {
  const length = String(barcode || "").length;
  if (length === 13) return "EAN13";
  if (length === 12) return "UPC";
  if (length === 8) return "EAN8";
  return null;
};

const toKebabCase = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "product";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * JsBarcode writes straight into an SVG element. It sets width/height but not
 * always a viewBox, and without one the symbol cannot be rescaled by CSS — which
 * the print label depends on. So we backfill the viewBox after every render.
 */
const drawBarcode = (svgElement, barcode, format, options) => {
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

const downloadSvgAsPng = async (svgElement, filename) => {
  const svgClone = svgElement.cloneNode(true);
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const width = Number(svgClone.getAttribute("width")) || 320;
  const height = Number(svgClone.getAttribute("height")) || 140;
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgUrl = URL.createObjectURL(
    new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }),
  );

  const img = new window.Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgUrl;
  });

  // 3x scale keeps the bar/module edges crisp when the PNG is dropped into a
  // label sheet or sent to a thermal printer. Works for the 1D barcode and the
  // QR code alike, since both are rendered as <svg> elements.
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgUrl);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, "image/png");
};

const printProductLabel = (productName, barcode, format, qrSvgOuterHTML) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  // 1D barcode block — only when the product actually has a scannable code.
  let barcodeBlock = "";
  if (format) {
    // Render a dedicated print symbol: taller bars and no on-canvas text, since
    // the label draws the digits itself at a controlled size.
    const printSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    drawBarcode(printSvg, barcode, format, {
      width: 3,
      height: 110,
      fontSize: 22,
      margin: 12,
    });
    printSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    barcodeBlock = `
      <div class="code-block">
        <div class="caption">POS</div>
        <div class="barcode">${printSvg.outerHTML}</div>
        <div class="digits">${barcode}</div>
      </div>`;
  }

  // QR block — a phone scan opens the product page directly. The SVG is the
  // same node the on-screen preview rendered, so the print matches the preview.
  const qrBlock = qrSvgOuterHTML
    ? `
      <div class="code-block">
        <div class="caption">Scan for product details</div>
        <div class="qr">${qrSvgOuterHTML}</div>
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
  <script>window.print();window.close();</script>
</body>
</html>`;

  printWindow.document.write(label);
  printWindow.document.close();
};

export function ProductBarcode({ productName, barcode, productUrl }) {
  const svgRef = useRef(null);
  const qrWrapperRef = useRef(null);
  const [renderError, setRenderError] = useState(null);
  const format = resolveFormat(barcode);
  const baseFileName = `naturanza-${toKebabCase(productName)}`;

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    if (!format) {
      setRenderError("This product has no scannable barcode assigned yet.");
      return;
    }

    try {
      drawBarcode(svgRef.current, barcode, format, {
        width: PREVIEW_BAR_WIDTH,
        height: PREVIEW_HEIGHT,
      });
      setRenderError(null);
    } catch {
      setRenderError("Barcode could not be rendered — the number looks invalid.");
    }
  }, [barcode, format]);

  const getQrSvg = () => qrWrapperRef.current?.querySelector("svg") || null;

  const handleDownloadBarcode = useCallback(() => {
    if (svgRef.current && !renderError) {
      downloadSvgAsPng(svgRef.current, `${baseFileName}-barcode.png`);
    }
  }, [baseFileName, renderError]);

  const handleDownloadQr = useCallback(() => {
    const qrSvg = getQrSvg();
    if (qrSvg) {
      downloadSvgAsPng(qrSvg, `${baseFileName}-qr.png`);
    }
  }, [baseFileName]);

  const handlePrint = useCallback(() => {
    const qrSvg = getQrSvg();
    const qrOuter = qrSvg ? qrSvg.outerHTML : "";
    if (!format && !qrOuter) {
      return;
    }
    printProductLabel(productName, barcode, format, qrOuter);
  }, [barcode, format, productName]);

  const hasQr = Boolean(productUrl);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {/* 1D barcode — read by retail POS / laser scanners */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            POS Barcode
          </span>
          <div className="inline-flex max-w-full overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,64,28,0.1)]">
            <svg ref={svgRef} />
          </div>
          {renderError ? (
            <p className="max-w-[280px] text-center text-sm font-medium text-amber-600">
              {renderError}
            </p>
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {SYMBOLOGY_LABELS[format]} · {barcode}
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
            {hasQr ? (
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
              {productName}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Scan to view product
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownloadBarcode}
          disabled={Boolean(renderError)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:pointer-events-none disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download Barcode
        </button>
        <button
          type="button"
          onClick={handleDownloadQr}
          disabled={!hasQr}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:pointer-events-none disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download QR
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!format && !hasQr}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
      </div>
    </div>
  );
}
