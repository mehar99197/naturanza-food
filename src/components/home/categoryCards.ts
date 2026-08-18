import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import type { Category } from "@/types/catalog";

/** Shown when a category's own image 404s. */
export const CATEGORY_FALLBACK_IMAGE = '/images/og-image.jpg';

export interface HomeCategoryCard {
  id: number;
  name: string;
  description: string;
  /** null when the category has no image; the card draws a placeholder instead. */
  image: string | null;
}

const normalizeImageUrl = (value: string | null): string | null => {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return null;
  }

  return getAbsoluteImageUrl(trimmed, { defaultFolder: 'categories' });
};

/**
 * Maps a category row to the shape the card needs, from Categories.jsx.
 *
 * The source read `category.image_url || category.image` off the raw API row;
 * the mapped `Category` publishes one `imageUrl`, which is the same column.
 * Names and descriptions are trimmed here rather than in the card so a
 * whitespace-only name can be filtered out — see `toCategoryCards`.
 */
const toCategoryCard = (category: Category): HomeCategoryCard => ({
  id: category.id,
  name: String(category.name || '').trim(),
  description: String(category.description || '').trim(),
  image: normalizeImageUrl(category.imageUrl),
});

/** Cards for every category that has a name, in the order given. */
export const toCategoryCards = (categories: Category[]): HomeCategoryCard[] =>
  categories.map(toCategoryCard).filter((item) => item.name);
