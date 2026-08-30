import { CURRENCY, SITE_NAME, SITE_URL, absoluteImage } from "@/config/site";
import type { ProductWithCategory } from "@/types/catalog";
import type { BlogPost } from "@/types/blog";

import { getProductPricing, type StoreDiscountSettings } from "@/server/catalog/pricing";

/**
 * Structured data builders.
 *
 * These replace the hand-assembled JSON-LD in backend/utils/seoRenderer.js. The
 * output is deliberately the same shape, with one deliberate correction noted on
 * `availability` below.
 *
 * Nothing here serialises to a string. Next renders JSON-LD through a script tag
 * whose content is JSON-encoded by React, so the `</script>` and `$&`
 * substitution hazards the old renderer had to defend against by hand cannot
 * arise here.
 */

export type JsonLd = Record<string, unknown>;

/**
 * A retail barcode maps to a length-specific Schema.org GTIN property.
 *
 * NOTE: whether these codes are registered to this business is an open
 * commercial question. Publishing a GTIN the seller does not own risks Merchant
 * Center disapproval. Behaviour is unchanged from the previous renderer on
 * purpose — this is a decision for the business, not a silent code change.
 */
const barcodeToGtin = (barcode: string | null): JsonLd => {
  const code = String(barcode ?? "").replace(/\D/g, "");
  if (code.length === 8) return { gtin8: code };
  if (code.length === 12) return { gtin12: code };
  if (code.length === 13) return { gtin13: code };
  return code ? { gtin: code } : {};
};

export const productUrl = (product: Pick<ProductWithCategory, "id">): string =>
  `${SITE_URL}/product/${product.id}`;

export const buildProductJsonLd = (
  product: ProductWithCategory,
  description: string,
  settings?: Partial<StoreDiscountSettings> | null,
): JsonLd => {
  const url = productUrl(product);
  const image = absoluteImage(product.imageUrl);
  const { salePrice } = getProductPricing(product, settings);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [image],
    description,
    // The stable internal identifier. Distinct from the GTIN: the GTIN is a
    // retail code that may or may not be ours, the SKU is always ours.
    sku: String(product.id),
    ...(product.categoryName ? { category: product.categoryName } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    ...barcodeToGtin(product.barcode),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: CURRENCY,
      price: salePrice.toFixed(2),
      // Availability now accounts for reserved stock, matching what the page
      // itself displays. The old renderer read stock_quantity alone, so a
      // product fully reserved by pending COD orders could advertise InStock
      // while its own page said otherwise — a structured-data mismatch Google
      // penalises.
      availability: product.isInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
};

export const buildBlogPostJsonLd = (post: BlogPost, description: string): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description,
  image: [absoluteImage(post.imageUrl)],
  author: { "@type": "Organization", name: post.author || SITE_NAME },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    logo: { "@type": "ImageObject", url: absoluteImage("/images/icon-512.png") },
  },
  datePublished: post.publishedAt?.toISOString(),
  dateModified: post.updatedAt?.toISOString(),
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${post.slug}` },
  ...(post.keywords.length ? { keywords: post.keywords.join(", ") } : {}),
});

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumbs give Google the site hierarchy instead of making it infer one. */
export const buildBreadcrumbJsonLd = (crumbs: Crumb[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: `${SITE_URL}${crumb.path}`,
  })),
});

export const buildItemListJsonLd = (
  items: { name: string; path: string }[],
  listName: string,
): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: listName,
  numberOfItems: items.length,
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    url: `${SITE_URL}${item.path}`,
  })),
});
