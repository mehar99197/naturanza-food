import "server-only";

import type { ShopProduct } from "@/components/shop/types";
import { queryRows } from "@/server/db/query";

import { toProductWithCategory, type ProductJoinRow } from "./mappers";

/**
 * The one read the shop pages need: the whole visible catalog, in one query.
 *
 * WHY THE WHOLE CATALOG AND NOT A PAGE OF IT. Shop.jsx never paginated. It
 * pulled every active product through `productAPI.getAll` (which walks
 * /products 500 rows at a time) and then did *all* of the filtering, sorting and
 * price-range work in the browser over that array. Two visible behaviours
 * depend on the full list being present:
 *
 *   • the sidebar's per-category counts, and the "All Products" total, are
 *     computed from the loaded products — not from a COUNT query;
 *   • the price slider filters against converted prices, using an exchange rate
 *     that only exists in the browser.
 *
 * Serving `/shop/[category]` a pre-filtered set would therefore make every
 * count on the page wrong. So the server sends the same array the SPA loaded,
 * already rendered into HTML, and the client island narrows it exactly as
 * before.
 *
 * `listProducts` in ./products is the wrong tool here: it clamps to 60 rows,
 * which is right for a rail or a related-products strip and wrong for a page
 * whose counts must add up.
 */

/** Visibility rule, identical to ./products — a soft-deleted row never shows. */
const VISIBLE = "p.is_active = TRUE AND p.deleted_at IS NULL";

/**
 * Hard ceiling on one shop render.
 *
 * The SPA's own ceiling was 5000, at which point it logged that the shop was
 * incomplete. 500 is the backend model's per-query maximum and is far above the
 * present catalog, but it is the number to revisit — not raise blindly — when
 * the catalog grows: past it, the counts and the client-side filtering both
 * stop being honest and the page needs real server-side pagination.
 */
export const SHOP_CATALOG_LIMIT = 500;

/**
 * `ShopProduct` — the row shape this module returns — is declared in
 * @/components/shop/types, next to the client island that consumes it. It is a
 * types-only module (no `"use client"`, no runtime imports beyond @/types), so
 * importing it here costs nothing and keeps one declaration rather than two
 * that could drift. The reverse import is the one that must never happen: a
 * Client Component reaching into `@/server/*` is a build error.
 */

/**
 * Every visible product, newest first.
 *
 * The ordering is `created_at DESC` because that is what the Express model used
 * for GET /products, and the shop's default "Featured" sort applies no sort of
 * its own — so this order *is* what "Featured" shows.
 */
export const listShopCatalog = async (
  limit: number = SHOP_CATALOG_LIMIT,
): Promise<ShopProduct[]> => {
  const cappedLimit = Math.min(Math.max(Math.trunc(Number(limit) || 0), 1), SHOP_CATALOG_LIMIT);

  const rows = await queryRows<ProductJoinRow>(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${VISIBLE}
      ORDER BY p.created_at DESC
      LIMIT ?`,
    [cappedLimit],
  );

  return rows.map((row) => ({
    ...toProductWithCategory(row),
    createdAtMs: new Date(row.created_at).getTime() || 0,
  }));
};
