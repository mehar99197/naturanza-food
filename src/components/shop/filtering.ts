/**
 * The shop's filtering and sorting rules, lifted verbatim out of the
 * `filteredProducts` / `categoryCounts` / `selectedCategoryName` memos in
 * frontend/src/pages/Shop.jsx.
 *
 * Pure functions with no React and no browser API, for two reasons. The obvious
 * one is that they are testable. The load-bearing one is that the Server
 * Component for /shop/[category] needs the *same* category predicate to build
 * the ItemList JSON-LD that the browser will use to render the grid — if the
 * two disagreed, the structured data would advertise products the page does not
 * show.
 *
 * Price filtering deliberately lives elsewhere (useShopFilters): it needs the
 * exchange-rate table, whose module-level state must not be read during server
 * rendering.
 */

import {
  ALL_CATEGORY_ID,
  DEFAULT_SORT_KEY,
  SHOP_SORT_KEYS,
  type ShopCategoryCounts,
  type ShopCategoryData,
  type ShopCategoryRef,
  type ShopProduct,
  type ShopSortKey,
} from "./types";

/** `String(x || "")` lowercased — the exact coercion Shop.jsx used throughout. */
const lower = (value: unknown): string => String(value || "").toLowerCase();

/**
 * "All Products" followed by the shop categories, in the order the API sent
 * them (the backend orders by name).
 *
 * Icon-free, so a Server Component can build the same list to filter against
 * without dragging the icon set into its module graph; the sidebar layers icons
 * on top in ./categoryOptions.
 */
export const buildCategoryRefs = (
  categories: readonly ShopCategoryData[],
): ShopCategoryRef[] => [
  { id: ALL_CATEGORY_ID, name: "All Products", slug: null },
  ...categories.map((category) => ({
    id: String(category.id),
    name: category.name,
    slug: category.slug,
  })),
];

/**
 * Keyword fallbacks for three launch categories whose products were never
 * actually assigned to them in the database.
 *
 * Keyed by *slug*, which matters: the sidebar navigates by numeric id, so this
 * fallback only ever fires on a `/shop/<slug>` URL. Preserved as found —
 * fixing the data is a catalog job, not a rendering one.
 */
const STARTUP_CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  honey: ["honey"],
  "herbal-oils": ["coconut"],
  "organic-powders": ["ispaghol", "psyllium"],
};

/** Coerces anything arriving from a URL into a sort key the grid understands. */
export const normalizeSortKey = (value: string | null | undefined): ShopSortKey =>
  SHOP_SORT_KEYS.find((key) => key === value) ?? DEFAULT_SORT_KEY;

/**
 * The sidebar entry a selection refers to, matched by id *or* slug — because
 * the selection can arrive as either: `/shop/<slug>` from the path, `?category=<id>`
 * from a sidebar click.
 */
export const findCategoryOption = (
  categories: readonly ShopCategoryRef[],
  selectedCategory: string,
): ShopCategoryRef | undefined =>
  categories.find(
    (category) =>
      category.id === selectedCategory ||
      lower(category.slug) === lower(selectedCategory),
  );

/** The heading the toolbar prints after the product count. */
export const resolveCategoryName = (
  categories: readonly ShopCategoryRef[],
  selectedCategory: string,
): string => findCategoryOption(categories, selectedCategory)?.name || "All Products";

/**
 * Per-category product counts for the sidebar badges.
 *
 * Counted over the loaded products rather than queried, exactly as before, so
 * the badges always agree with what the grid can show. Two of the four original
 * clauses tested a free-text `category` field that the catalog endpoint does not
 * publish and so could never match; they are dropped rather than reproduced as
 * conditions that are structurally always false.
 */
export const countByCategory = (
  products: readonly ShopProduct[],
  categories: readonly ShopCategoryRef[],
): ShopCategoryCounts => {
  const counts: ShopCategoryCounts = { [ALL_CATEGORY_ID]: products.length };

  for (const category of categories) {
    if (category.id === ALL_CATEGORY_ID) continue;

    counts[category.id] = products.filter(
      (product) =>
        String(product.categoryId) === category.id ||
        product.categoryName === category.name,
    ).length;
  }

  return counts;
};

/**
 * Name / category / description substring match.
 *
 * ⚠ The guard trims and the query does not — `"  honey"` passes the emptiness
 * check and then matches nothing, because the leading spaces are still in the
 * needle. That is Shop.jsx's behaviour and is preserved; see the report.
 */
export const filterBySearch = (
  products: readonly ShopProduct[],
  searchQuery: string,
): ShopProduct[] => {
  if (!searchQuery.trim()) return [...products];

  const query = searchQuery.toLowerCase();

  return products.filter(
    (product) =>
      lower(product.name).includes(query) ||
      lower(product.categoryName).includes(query) ||
      lower(product.description).includes(query),
  );
};

/**
 * Narrows to one category, accepting an id, a slug or a display name.
 *
 * The pile of alternatives below is the original's, because the selection has
 * three different provenances and the data is inconsistent about which of them
 * a product row can be matched on. The `&&` inside the chain binds tighter than
 * the surrounding `||`, so it is one clause among the alternatives — the
 * explicit parentheses here say so without changing the result.
 */
export const filterByCategory = (
  products: readonly ShopProduct[],
  selectedCategory: string,
  categories: readonly ShopCategoryRef[],
): ShopProduct[] => {
  if (selectedCategory === ALL_CATEGORY_ID) return [...products];

  const entry = findCategoryOption(categories, selectedCategory);
  const displayName = String(entry?.name || "");
  const normalized = lower(selectedCategory);
  const keywords = STARTUP_CATEGORY_KEYWORDS[normalized] ?? [];

  return products.filter((product) => {
    const directCategoryMatch =
      String(product.categoryId) === selectedCategory ||
      String(product.categoryName) === selectedCategory ||
      lower(product.categorySlug) === normalized ||
      (lower(entry?.slug) === normalized &&
        String(product.categoryId) === String(entry?.id)) ||
      String(product.categoryName) === displayName;

    if (directCategoryMatch) return true;
    if (keywords.length === 0) return false;

    const searchableText = [
      product.slug,
      product.name,
      product.categoryName,
      product.description,
    ]
      .map(lower)
      .join(" ");

    return keywords.some((keyword) => searchableText.includes(keyword));
  });
};

/**
 * Applies the toolbar's sort. Returns a new array; the source is never mutated.
 *
 * "Highest Rated" is intentionally inert. Shop.jsx sorted on `product.rating`,
 * and GET /products has never returned a rating or a review count — so the
 * comparator was always `0 - 0` and, `Array#sort` being stable, the order never
 * moved. Dropping the menu entry would be a visible change, and inventing a
 * rating join would change the star row on every card too, so the branch stays
 * and stays a no-op. See the report.
 */
export const sortProducts = (
  products: readonly ShopProduct[],
  sortBy: ShopSortKey,
): ShopProduct[] => {
  const result = [...products];

  switch (sortBy) {
    case "price-low":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      result.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      result.sort((a, b) => b.createdAtMs - a.createdAtMs);
      break;
    case "rating":
    case "featured":
    default:
      break;
  }

  return result;
};
