import { Leaf, Package, Star, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatPrice, getProductPricing } from "@/lib/utils";
import type { StoreDiscountSettings } from "@/lib/pricing";

import type { HeroSlideData } from "./heroSlides";

/** One pill under the hero copy. `Icon` is absent on the category chip. */
export interface HeroChip {
  key: string;
  label: string;
  classes: string;
  Icon?: LucideIcon;
}

/** At most three pills fit on the narrowest layout the source supports. */
const MAX_CHIPS = 3;

/**
 * The pills under the hero headline, in the source's priority order: price (or
 * discount + sale price), rating, category, organic, in stock — then sliced to
 * three, so the later chips only appear when an earlier one is missing.
 *
 * Pricing goes through `getProductPricing`, which is why `HeroSlideData` keeps
 * the raw `discount_percentage` spelling: a store-wide sale can beat a product's
 * own discount, and recomputing the percentage here would be the bug that
 * charged full price.
 *
 * `null` returns `[]`. The source passed `currentSlideData || {}` and every
 * branch below rejects an empty object, so this is the same answer stated
 * directly.
 */
export const buildSlideChips = (
  slide: HeroSlideData | null,
  settings?: Partial<StoreDiscountSettings> & { currency?: string },
): HeroChip[] => {
  if (!slide) return [];

  const currency = settings?.currency || 'PKR';
  const chips: HeroChip[] = [];
  const pricing = getProductPricing(slide, settings);

  // `price` is null when the row had no usable price; the source relied on
  // `Number.isFinite` rejecting it, which it still does — the explicit check is
  // only here because it does not narrow the type.
  if (slide.price !== null && Number.isFinite(slide.price) && slide.price > 0) {
    if (pricing.onSale) {
      // Store sale active — lead with the discount, then the sale price.
      chips.push({
        key: 'sale',
        label: `${pricing.effectivePct}% OFF`,
        classes: 'border-rose-300 bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold',
        Icon: Tag,
      });
      chips.push({
        key: 'price',
        label: `Now ${formatPrice(pricing.salePrice, currency)}`,
        classes: 'border-emerald-200 bg-white/80 text-emerald-800',
        Icon: Tag,
      });
    } else {
      chips.push({
        key: 'price',
        label: `From ${formatPrice(slide.price, currency)}`,
        classes: 'border-emerald-200 bg-white/80 text-emerald-800',
        Icon: Tag,
      });
    }
  }

  if (Number.isFinite(slide.rating) && slide.rating > 0) {
    const reviewLabel = slide.reviewCount > 0 ? ` (${slide.reviewCount})` : '';
    chips.push({
      key: 'rating',
      label: `${slide.rating.toFixed(1)}${reviewLabel}`,
      classes: 'border-amber-200 bg-amber-50/80 text-amber-800',
      Icon: Star,
    });
  }

  if (slide.category) {
    chips.push({
      key: 'category',
      label: slide.category,
      classes: 'border-slate-200 bg-white/70 text-slate-700',
    });
  }

  if (slide.isOrganic) {
    chips.push({
      key: 'organic',
      label: 'Organic',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      Icon: Leaf,
    });
  }

  if (slide.inStock) {
    chips.push({
      key: 'stock',
      label: 'In stock',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      Icon: Package,
    });
  }

  return chips.slice(0, MAX_CHIPS);
};
