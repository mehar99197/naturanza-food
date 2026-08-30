/**
 * The gallery image list for one product, ported from
 * frontend/src/pages/ProductDetail.jsx.
 *
 * WHAT SHRANK AND WHY: the SPA gathered candidates from five fields —
 * `image_url`, `image`, `image_urls`, `images` and `gallery_images` — because
 * it was handed whatever JSON the API returned. Only two of those are real
 * columns (`image_url` and the `images` JSON blob, see ProductRow); the other
 * three never existed in the schema and were always empty. Reading the mapped
 * domain type here makes that explicit instead of preserving three dead reads.
 *
 * De-duplication is preserved: a product whose `images` array repeats its main
 * photo shows one thumbnail, not two.
 */

import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import type { ProductImage } from "@/types/catalog";

import { FALLBACK_IMAGE, getProductFallbackImage, type FallbackImageSource } from "./constants";

export interface GallerySource extends FallbackImageSource {
  imageUrl: string | null;
  images: readonly ProductImage[];
}

/** Resolves one stored value into a loadable URL, or null if it is blank. */
const normalizeImageSource = (value: string | null | undefined): string | null => {
  const imageValue = String(value ?? "").trim();
  if (!imageValue) return null;

  return getAbsoluteImageUrl(imageValue, { defaultFolder: "products" }) || null;
};

/**
 * Always returns at least one entry: a product with no usable image falls back
 * to the category-appropriate stock photo, so the gallery is never empty and
 * `images[0]` is always safe to read for og:image.
 */
export const getGalleryImages = (product: GallerySource | null | undefined): string[] => {
  const fallback = product ? getProductFallbackImage(product) : FALLBACK_IMAGE;
  if (!product) return [fallback];

  const candidates: (string | null)[] = [
    product.imageUrl,
    ...product.images.map((image) => image.imageUrl),
  ];

  const normalized = candidates
    .map((item) => normalizeImageSource(item))
    .filter((item): item is string => Boolean(item));

  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [fallback];
};
