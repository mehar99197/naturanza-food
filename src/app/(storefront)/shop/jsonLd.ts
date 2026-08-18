import type { ShopProduct } from "@/components/shop/types";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, type JsonLd } from "@/server/seo/jsonLd";

/**
 * Structured data for the two shop routes.
 *
 * The BreadcrumbList is a direct port of `ShopBreadcrumbStructuredData` in
 * frontend/src/components/StructuredData.jsx, including its habit of deriving
 * the category's display name from the slug (`herbal-oils` -> "Herbal Oils")
 * rather than from the category record — so the trail reads the same as the one
 * already indexed.
 *
 * The ItemList is new. The SPA published no list of the products on the page,
 * which meant the single most valuable fact about a category page — which
 * products it contains, and where each one lives — was never expressed. It is
 * built from the products the page actually renders on first paint, using the
 * same category predicate the browser will use, so the two cannot disagree.
 *
 * `CollectionPageStructuredData` in StructuredData.jsx is deliberately NOT
 * ported: it is dead code (no page ever rendered it) and its `mainEntity`
 * ItemList carried a count with an empty `itemListElement`, which is worse than
 * publishing nothing. See the report.
 */

/** `herbal-oils` -> `Herbal Oils`, the transform ShopBreadcrumbStructuredData used. */
const titleCaseSlug = (slug: string): string =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export interface ShopJsonLdOptions {
  /** Products the page renders on first paint, in render order. */
  products: readonly ShopProduct[];
  /** Name for the ItemList — the page's own title. */
  listName: string;
  /** The `[category]` slug, or null for `/shop`. */
  categorySlug: string | null;
}

export const buildShopJsonLd = ({
  products,
  listName,
  categorySlug,
}: ShopJsonLdOptions): JsonLd[] => {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
  ];

  if (categorySlug) {
    crumbs.push({
      name: titleCaseSlug(categorySlug),
      path: `/shop/${categorySlug}`,
    });
  }

  return [
    buildItemListJsonLd(
      products.map((product) => ({
        name: product.name,
        path: `/product/${product.id}`,
      })),
      listName,
    ),
    buildBreadcrumbJsonLd(crumbs),
  ];
};
