/**
 * Static tables the product page renders from, ported verbatim from
 * frontend/src/pages/ProductDetail.jsx.
 *
 * The fallback-image lookup is a keyword sweep over the product's own name and
 * its category, in a fixed order that matters: "coconut" is tested before
 * "oil", so "Organic Coconut Oil" resolves to the coconut photo rather than the
 * generic oil one. Reordering these lines changes which picture a product gets.
 */

/** Shown when a product has no usable image, and when an <img> fails to load. */
export const FALLBACK_IMAGE = "/images/products/herbs.webp";

const PRODUCT_FALLBACK_IMAGES = {
  honey: "/images/products/honey.webp",
  tea: "/images/products/tea.webp",
  oil: "/images/products/oil.webp",
  coconut: "/images/products/coconut-oil.webp",
  powder: "/images/products/ispaghol_2.webp",
  ispaghol: "/images/products/ispaghol_2.webp",
  psyllium: "/images/products/ispaghol_2.webp",
  seeds: "/images/products/ispaghol_2.webp",
  supplements: "/images/products/herbs.webp",
  aloe: "/images/products/herbs.webp",
  herbs: "/images/products/herbs.webp",
  default: "/images/products/herbs.webp",
} as const;

/**
 * The product fields the fallback lookup reads.
 *
 * Both category spellings are declared because the same helper is fed by two
 * shapes: the mapped domain type spells it `categoryName`, and the raw API row
 * the SPA passed spells it `category_name`. The original read only the raw
 * spellings, so a mapped product would have lost the category signal entirely.
 */
export interface FallbackImageSource {
  name?: string | null;
  /** Mapped domain shape. */
  categoryName?: string | null;
  /** Raw API shape. */
  category_name?: string | null;
  /** Free-text category on payloads carrying no join. */
  category?: string | null;
}

export const getProductFallbackImage = (
  product: FallbackImageSource | null | undefined,
): string => {
  if (!product || !product.name) return FALLBACK_IMAGE;

  const text = `${product.name ?? ""} ${product.categoryName ?? product.category_name ?? ""} ${
    product.category ?? ""
  }`.toLowerCase();

  if (text.includes("honey")) return PRODUCT_FALLBACK_IMAGES.honey;
  if (text.includes("tea") || text.includes("chai")) return PRODUCT_FALLBACK_IMAGES.tea;
  if (text.includes("coconut")) return PRODUCT_FALLBACK_IMAGES.coconut;
  if (text.includes("oil")) return PRODUCT_FALLBACK_IMAGES.oil;
  if (text.includes("powder") || text.includes("superfood") || text.includes("greens"))
    return PRODUCT_FALLBACK_IMAGES.powder;
  if (text.includes("ispaghol") || text.includes("psyllium"))
    return PRODUCT_FALLBACK_IMAGES.ispaghol;
  if (text.includes("seed")) return PRODUCT_FALLBACK_IMAGES.seeds;
  if (text.includes("supplement") || text.includes("capsule"))
    return PRODUCT_FALLBACK_IMAGES.supplements;
  if (text.includes("aloe")) return PRODUCT_FALLBACK_IMAGES.aloe;
  if (text.includes("herb")) return PRODUCT_FALLBACK_IMAGES.herbs;

  return PRODUCT_FALLBACK_IMAGES.default;
};

export type DetailSectionKey = "description" | "ingredients" | "benefits" | "usage";

export interface DetailSection {
  key: DetailSectionKey;
  label: string;
}

/** Tab order on desktop, accordion order on mobile. Same list, one source. */
export const DETAIL_SECTIONS: readonly DetailSection[] = [
  { key: "description", label: "Description" },
  { key: "ingredients", label: "Ingredients" },
  { key: "benefits", label: "Benefits" },
  { key: "usage", label: "Usage" },
];
