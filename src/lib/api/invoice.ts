/** Helpers for turning an invoice response into a downloadable file. */

/**
 * Reads the filename out of a `Content-Disposition` header.
 *
 * RFC 5987's `filename*=UTF-8''…` form is checked first because it is the one
 * that survives non-ASCII customer names; the plain `filename="…"` form is the
 * fallback, and a malformed percent-encoding degrades to the raw value rather
 * than throwing mid-download.
 */
export const getFilenameFromContentDisposition = (
  contentDisposition: string | undefined | null,
  fallback = "invoice.pdf",
): string => {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    const encoded = utf8Match[1].replace(/['"]/g, "");
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded || fallback;
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallback;
};

/**
 * Coerces whatever the transport produced into a `Blob` the browser will save.
 *
 * A `responseType: "blob"` request normally yields a Blob directly, but an
 * error body parsed as text, or a buffer from an older code path, must still
 * come out as something `URL.createObjectURL` accepts.
 */
export const normalizePdfBlob = (
  payload: unknown,
  contentType = "application/pdf",
): Blob => {
  const type = contentType || "application/pdf";

  if (payload instanceof Blob) {
    return payload;
  }

  if (payload instanceof ArrayBuffer) {
    return new Blob([payload], { type });
  }

  if (typeof payload === "string") {
    return new Blob([payload], { type });
  }

  return new Blob([], { type });
};
