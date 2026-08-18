import "server-only";

import type { ShopCategoryData, ShopProduct } from "@/components/shop/types";
import { listCategories } from "@/server/catalog/categories";
import { listShopCatalog } from "@/server/catalog/shopQuery";

/**
 * The two reads both shop routes make, with the SPA's failure behaviour.
 *
 * Shop.jsx treated the two fetches very differently and this keeps that split:
 *
 *   • the categories request swallowed its own failure — a missing filter rail
 *     is a degraded page, not a broken one, so the sidebar falls back to
 *     "All Products" alone and the grid still works;
 *   • a failed product fetch put the error on screen with a "Try again" button.
 *
 * The message shown for that second case is deliberately fixed rather than the
 * thrown error's text. In the browser the thrown error was an axios message
 * ("Network Error"); here it would be whatever mysql2 said, which can name the
 * host, the database and the failing statement. The real cause is logged
 * server-side instead.
 */

/** What the client island needs to render the sidebar. */
const toCategoryData = (category: {
  id: number;
  name: string;
  slug: string;
}): ShopCategoryData => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
});

export interface ShopData {
  products: ShopProduct[];
  categories: ShopCategoryData[];
  productsError: string | null;
}

const PRODUCTS_ERROR = "We could not load the catalog just now. Please try again.";

export const loadShopData = async (): Promise<ShopData> => {
  const [productsResult, categoriesResult] = await Promise.allSettled([
    listShopCatalog(),
    listCategories("shop"),
  ]);

  if (productsResult.status === "rejected") {
    console.error("[shop] catalog query failed", productsResult.reason);
  }
  if (categoriesResult.status === "rejected") {
    console.error("[shop] category query failed", categoriesResult.reason);
  }

  return {
    products: productsResult.status === "fulfilled" ? productsResult.value : [],
    categories:
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.map(toCategoryData)
        : [],
    productsError: productsResult.status === "rejected" ? PRODUCTS_ERROR : null,
  };
};
