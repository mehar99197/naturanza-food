/**
 * Which picture a product card shows, ported from the module-scope helpers in
 * frontend/src/components/ProductCard.jsx.
 *
 * The algorithm is unchanged: collect every field that could hold an image, take
 * the first that resolves to a usable URL, and fall back to a hand-picked local
 * asset chosen by keyword when the product has no image at all. That keyword
 * fallback is why a brand-new product still looks deliberate rather than showing
 * a broken-image box.
 *
 * ONE THING WAS ADDED, and it is a bug fix rather than a change of behaviour:
 * the original read only `image_url` / `images[].image_url` / `images[].url`.
 * Under Next, Server Components hand the card the *mapped* product, whose field
 * is `imageUrl` and whose `images` entries are `{ imageUrl, altText }` — so every
 * server-rendered card would have silently missed its real photo and fallen
 * through to the keyword guess. Both spellings are now read, in the same order.
 * Nothing about the snake_case path changed, so client-rendered cards resolve to
 * exactly the URL they did before.
 */

import { getAbsoluteImageUrl } from "@/lib/imageUtils";

import type { ProductCardProduct } from "./types";

export const LOCAL_CARD_IMAGES = {
  honey: '/images/products/honey.webp',
  tea: '/images/products/tea.webp',
  oil: '/images/products/oil.webp',
  powder: '/images/products/ispaghol_2.webp',
  seeds: '/images/products/ispaghol_2.webp',
  supplements: '/images/products/herbs.webp',
  aloe: '/images/products/herbs.webp',
  coconut: '/images/products/coconut-oil.webp',
  herbs: '/images/products/herbs.webp',
  default: '/images/products/honey.webp',
} as const;

function normalizeImageSrc(value: unknown): string | null {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return null;
  }

  // Use getAbsoluteImageUrl to convert relative URLs to absolute backend URLs
  return getAbsoluteImageUrl(candidate, { defaultFolder: 'products' });
}

function getProductImageFromPayload(
  product: ProductCardProduct | null | undefined,
): string | null {
  const candidates: string[] = [];

  if (typeof product?.image_url === 'string') {
    candidates.push(product.image_url);
  }

  if (typeof product?.imageUrl === 'string') {
    candidates.push(product.imageUrl);
  }

  if (typeof product?.image === 'string') {
    candidates.push(product.image);
  }

  if (Array.isArray(product?.images)) {
    product.images.forEach((entry) => {
      if (typeof entry === 'string') {
        candidates.push(entry);
        return;
      }

      if (entry && typeof entry === 'object') {
        if (typeof entry.image_url === 'string') {
          candidates.push(entry.image_url);
        }
        if (typeof entry.url === 'string') {
          candidates.push(entry.url);
        }
        if (typeof entry.imageUrl === 'string') {
          candidates.push(entry.imageUrl);
        }
      }
    });
  }

  for (const candidate of candidates) {
    const normalized = normalizeImageSrc(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function resolveCardImage(
  product: ProductCardProduct | null | undefined,
): string {
  const directImage = getProductImageFromPayload(product);
  if (directImage) {
    return directImage;
  }

  // `category_name || categoryName` rather than a fourth segment, so the string
  // a snake_case payload produces is byte-identical to the Vite app's.
  const text = `${product?.name || ''} ${product?.category_name || product?.categoryName || ''} ${product?.category || ''}`.toLowerCase();

  if (text.includes('honey')) return LOCAL_CARD_IMAGES.honey;
  if (text.includes('tea') || text.includes('chai')) return LOCAL_CARD_IMAGES.tea;
  if (text.includes('coconut')) return LOCAL_CARD_IMAGES.coconut;
  if (text.includes('oil')) return LOCAL_CARD_IMAGES.oil;
  if (text.includes('powder') || text.includes('superfood') || text.includes('greens') || text.includes('ispaghol') || text.includes('psyllium')) return LOCAL_CARD_IMAGES.powder;
  if (text.includes('seed')) return LOCAL_CARD_IMAGES.seeds;
  if (text.includes('supplement') || text.includes('capsule') || text.includes('curcumin') || text.includes('probiotic')) return LOCAL_CARD_IMAGES.supplements;
  if (text.includes('aloe')) return LOCAL_CARD_IMAGES.aloe;
  if (text.includes('herb')) return LOCAL_CARD_IMAGES.herbs;

  return LOCAL_CARD_IMAGES.default;
}
