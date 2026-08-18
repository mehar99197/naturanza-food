/**
 * Text normalisation for the product detail copy, ported from
 * frontend/src/pages/ProductDetail.jsx.
 *
 * The `ingredients`, `benefits` and `usage` columns are free text typed by an
 * admin, and every separator anyone has ever used is in production: newlines,
 * commas, bullet characters, and — from an older admin form — a JSON array
 * serialised into the same column. `toArray` accepts all of them, because
 * picking one and rejecting the rest would blank out real product copy.
 */

/**
 * Splits an admin-entered list field into individual items.
 *
 * A string that looks like a JSON array is parsed as one first; if that fails
 * it falls through to separator splitting rather than throwing, so a malformed
 * `[...` value still renders as text.
 */
export const toArray = (value: unknown): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];

    if (normalized.startsWith("[") && normalized.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(normalized);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
        }
      } catch {
        /* ignored: not fatal to this flow */
      }
    }

    // `•` and `•` are the same character. The duplicate is in the original
    // and is kept rather than tidied, so this regex stays diff-able against it.
    return normalized
      .split(/\n+|,|•|•/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

/** Splits a description into paragraphs on blank lines. */
export const toParagraphs = (value: unknown): string[] => {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return [];

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
};

/**
 * The meta description this page publishes.
 *
 * First paragraph of the product description, truncated at 152 characters plus
 * an ellipsis once it exceeds 155 — the same two numbers the SPA used, kept so
 * the description a crawler already has on file does not churn on migration
 * day. Falls back to a sentence naming the product when the column is empty.
 */
export const metaDescriptionFor = (
  descriptionParagraphs: readonly string[],
  productName: string,
): string => {
  const first = descriptionParagraphs[0];

  if (first) {
    const desc = first.trim();
    return desc.length > 155 ? `${desc.substring(0, 152)}...` : desc;
  }

  return `Buy ${productName} at Naturanza Food. Premium organic and natural product. Order online with Cash on Delivery in Pakistan.`;
};
