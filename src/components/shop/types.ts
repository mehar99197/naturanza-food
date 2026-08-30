/**
 * Shapes shared by the shop pages, the filtering helpers and the client island.
 *
 * Types only — no `"use client"`, no runtime dependency beyond @/types/catalog —
 * so both the Server Components under app/(storefront)/shop and the browser-side
 * components here import from the same declaration. @/server/catalog/shopQuery
 * imports `ShopProduct` from here for the same reason; the opposite direction
 * would pull a `server-only` module into the client bundle.
 */

import type { LucideIcon } from "lucide-react";
import type { ProductWithCategory } from "@/types/catalog";

/**
 * A catalog product as the shop renders it.
 *
 * `createdAtMs` is epoch milliseconds rather than a Date: it crosses the
 * server/client boundary as a primitive, and being a number it cannot be
 * accidentally formatted (an unlocalised date string is the classic hydration
 * mismatch). Only the "Newest" sort reads it.
 */
export interface ShopProduct extends ProductWithCategory {
  createdAtMs: number;
}

/** Grid or list — the two layouts the toolbar toggles between. */
export type ShopViewMode = "grid" | "list";

/** The five values of the sort `<select>`, in the order it lists them. */
export type ShopSortKey = "featured" | "price-low" | "price-high" | "rating" | "newest";

/** Every accepted sort key, used to validate anything arriving from outside. */
export const SHOP_SORT_KEYS: readonly ShopSortKey[] = [
  "featured",
  "price-low",
  "price-high",
  "rating",
  "newest",
];

export const DEFAULT_SORT_KEY: ShopSortKey = "featured";

/** The id the sidebar's first entry uses; also the "no category filter" value. */
export const ALL_CATEGORY_ID = "all";

/**
 * A category as the sidebar lists it.
 *
 * `id` is a string throughout even though the database column is an integer,
 * because Shop.jsx compared it with `String(...)` on both sides everywhere and
 * used it as an object key in the counts map (where JavaScript would have
 * stringified it anyway). Normalising once at the edge removes every one of
 * those conversions without changing a single comparison's result.
 *
 * The synthetic "All Products" entry carries `id: "all"` and a null slug, which
 * is exactly the shape Shop.jsx seeded its `categories` state with.
 */
export interface ShopCategoryRef {
  id: string;
  name: string;
  slug: string | null;
}

/** A category ref plus the sidebar icon. Only the browser needs the icon. */
export interface ShopCategoryOption extends ShopCategoryRef {
  Icon: LucideIcon;
}

/** The plain category data a Server Component hands the island. */
export interface ShopCategoryData {
  id: number;
  name: string;
  slug: string;
}

/** Category id -> number of products in it, keyed the way Shop.jsx keyed it. */
export type ShopCategoryCounts = Record<string, number>;

/** Lower bound and upper bound of the price slider, in the display currency. */
export type ShopPriceRange = readonly [number, number];
