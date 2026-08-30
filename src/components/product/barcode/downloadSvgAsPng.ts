/**
 * Rasterising an on-page `<svg>` to a PNG download, ported from
 * `ProductBarcode.jsx`.
 *
 * Works for the 1D barcode and the QR code alike, since both are rendered as
 * `<svg>` elements — which is the reason the QR half uses `QRCodeSVG` rather
 * than the canvas variant.
 *
 * Every DOM touch is inside the function, so this module is safe to import on
 * the server; it simply never runs there.
 */

/**
 * 3x scale keeps the bar/module edges crisp when the PNG is dropped into a label
 * sheet or sent to a thermal printer.
 */
const EXPORT_SCALE = 3;

/** Fallbacks for an SVG that somehow carries no width/height attributes. */
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 140;

export const downloadSvgAsPng = async (
  svgElement: SVGSVGElement,
  filename: string,
): Promise<void> => {
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const width = Number(svgClone.getAttribute("width")) || FALLBACK_WIDTH;
  const height = Number(svgClone.getAttribute("height")) || FALLBACK_HEIGHT;
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgUrl = URL.createObjectURL(
    new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }),
  );

  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Barcode image could not be rasterised"));
    img.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;

  const ctx = canvas.getContext("2d");
  // Null only when the context was already claimed with a different type, which
  // cannot happen for a canvas created three lines up — but the type says it can,
  // and bailing out beats a non-null assertion.
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    return;
  }

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
