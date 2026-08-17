import "server-only";

import { queryOne, queryRows } from "@/server/db/query";
import type { Category, CategoryRow, CategoryWithCount, CategoryPlacement } from "@/types/catalog";

import { toCategory } from "./mappers";

/**
 * Read access to categories for server-rendered pages.
 *
 * `category_type` decides where a category is allowed to appear: the shop filter
 * rail, the "shop by category" grid on the homepage, or both. Filtering happens
 * in SQL rather than after the fetch so a placement change cannot leak a
 * category onto a surface it was excluded from.
 */

const VISIBLE = "c.is_active = TRUE";

/** Categories eligible for a given surface, including those marked "both". */
const placementCondition = (placement: Exclude<CategoryPlacement, "both">) =>
  ({ sql: "c.category_type IN (?, 'both')", param: placement }) as const;

export const listCategories = async (
  placement?: Exclude<CategoryPlacement, "both">,
): Promise<Category[]> => {
  const conditions = [VISIBLE];
  const params: string[] = [];

  if (placement) {
    const { sql, param } = placementCondition(placement);
    conditions.push(sql);
    params.push(param);
  }

  const rows = await queryRows<CategoryRow>(
    `SELECT c.* FROM categories c
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.name ASC`,
    params,
  );

  return rows.map(toCategory);
};

export const getCategoryBySlug = async (slug: string): Promise<Category | null> => {
  if (!slug) return null;

  const row = await queryOne<CategoryRow>(
    `SELECT c.* FROM categories c WHERE c.slug = ? AND ${VISIBLE} LIMIT 1`,
    [slug],
  );

  return row ? toCategory(row) : null;
};

/**
 * Categories with their live product count, in one query.
 *
 * The obvious shape — fetch categories, then count per category — is an N+1 that
 * grows with the catalog. A single grouped LEFT JOIN gives the same answer in
 * one round trip, and the join condition carries the same visibility rule the
 * product queries use so the counts match what the shop actually lists.
 */
export const listCategoriesWithCounts = async (
  placement?: Exclude<CategoryPlacement, "both">,
): Promise<CategoryWithCount[]> => {
  const conditions = [VISIBLE];
  const params: string[] = [];

  if (placement) {
    const { sql, param } = placementCondition(placement);
    conditions.push(sql);
    params.push(param);
  }

  const rows = await queryRows<CategoryRow & { product_count: number }>(
    `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p
         ON p.category_id = c.id
        AND p.is_active = TRUE
        AND p.deleted_at IS NULL
      WHERE ${conditions.join(" AND ")}
      GROUP BY c.id
      ORDER BY c.name ASC`,
    params,
  );

  return rows.map((row) => ({
    ...toCategory(row),
    productCount: Number(row.product_count) || 0,
  }));
};

/** Slugs for sitemap and static-params generation. */
export const listCategorySlugs = async (): Promise<string[]> => {
  const rows = await queryRows<{ slug: string }>(
    `SELECT c.slug FROM categories c WHERE ${VISIBLE} ORDER BY c.slug ASC`,
  );

  return rows.map((row) => row.slug);
};
