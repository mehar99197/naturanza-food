/**
 * The sidebar's icons, ported from the `fetchCategories` effect in
 * frontend/src/pages/Shop.jsx.
 *
 * The icon assignment is deliberately meaningless: the SPA cycled a fixed
 * five-icon array by list position (`icons[idx % icons.length]`), so a category
 * called "Honey" gets a droplet only because it happens to sort first. That is
 * preserved exactly — deriving an icon from the category name would look like a
 * fix and would silently change every icon on the page.
 *
 * The list itself is built by `buildCategoryRefs` in ./filtering, which the
 * Server Components also use; this only decorates it.
 */

import { Coffee, Droplet, Flower2, Pill, ShoppingBag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { buildCategoryRefs } from "./filtering";
import {
  ALL_CATEGORY_ID,
  type ShopCategoryData,
  type ShopCategoryOption,
} from "./types";

/** Cycled by position over the categories the API returns. */
const CATEGORY_ICONS: readonly LucideIcon[] = [
  Droplet,
  Flower2,
  Coffee,
  Pill,
  ShoppingBag,
];

export const buildCategoryOptions = (
  categories: readonly ShopCategoryData[],
): ShopCategoryOption[] =>
  buildCategoryRefs(categories).map((category, index) => ({
    ...category,
    // "All Products" always wore the bag; the cycle starts at the first real
    // category, so its index is one behind this list's.
    Icon:
      category.id === ALL_CATEGORY_ID
        ? ShoppingBag
        : // The modulo can never fall off the end; the `??` only satisfies
          // noUncheckedIndexedAccess and repeats the first icon.
          CATEGORY_ICONS[(index - 1) % CATEGORY_ICONS.length] ?? ShoppingBag,
  }));
