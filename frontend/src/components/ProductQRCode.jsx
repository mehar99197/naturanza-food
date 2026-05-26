import { useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer } from "lucide-react";

const QR_SIZE = 200;
const QR_FG = "#166534";
const QR_BG = "#ffffff";

const toKebabCase = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "product";

const downloadQrAsPng = async (svgElement, filename) => {
  const svgClone = svgElement.cloneNode(true);
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new window.Image();
  img.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  const padding = 40;
  canvas.width = QR_SIZE + padding * 2;
  canvas.height = QR_SIZE + padding * 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, padding, padding, QR_SIZE, QR_SIZE);

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

const printQrLabel = (productName, productUrl) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const label = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Label - ${productName}</title>
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
    padding: 32px;
    max-width: 380px;
  }
  .brand {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #166534;
    margin-bottom: 16px;
  }
  .brand-divider {
    width: 60px;
    height: 3px;
    background: #16a34a;
    margin: 0 auto 20px;
    border-radius: 2px;
  }
  .qr-wrapper {
    display: inline-block;
    padding: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .qr-wrapper svg { display: block; width: 240px; height: 240px; }
  .product-name {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 4px;
  }
  .scan-text {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 8px;
  }
  .website {
    font-size: 11px;
    font-weight: 600;
    color: #166534;
    letter-spacing: 0.04em;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="brand">NATURANZA FOOD</div>
    <div class="brand-divider"></div>
    <div class="qr-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${QR_SIZE} ${QR_SIZE}" width="${QR_SIZE}" height="${QR_SIZE}">
        ${document.querySelector("#qr-code-svg svg")?.innerHTML || ""}
      </svg>
    </div>
    <div class="product-name">${productName}</div>
    <div class="scan-text">Scan to view details</div>
    <div class="website">naturanzafood.com</div>
  </div>
  <script>window.print();window.close();</script>
</body>
</html>`;

  printWindow.document.write(label);
  printWindow.document.close();
};

export function ProductQRCode({ productId, productName, productSlug }) {
  const qrRef = useRef(null);
  const productUrl = `${window.location.origin}/product/${productId}`;
  const fileName = `naturanza-${toKebabCase(productName)}-qr.png`;

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector("svg");
    if (svg) downloadQrAsPng(svg, fileName);
  }, [fileName]);

  const handlePrint = useCallback(() => {
    printQrLabel(productName, productUrl);
  }, [productName, productUrl]);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div ref={qrRef} id="qr-code-svg" className="inline-flex rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,64,28,0.1)]">
        <QRCodeSVG
          value={productUrl}
          size={QR_SIZE}
          fgColor={QR_FG}
          bgColor={QR_BG}
          level="M"
          includeMargin
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800 max-w-[260px] line-clamp-2">
          {productName}
        </p>
        <p className="mt-1 text-[11px] text-slate-400 break-all max-w-[260px]">
          {productUrl}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d]"
        >
          <Download className="h-4 w-4" />
          Download QR Code
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
      </div>
    </div>
  );
}
