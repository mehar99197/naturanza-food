import "server-only";

import { queryOne, queryRows, queryScalar } from "@/server/db/query";
import type { ProductWithCategory } from "@/types/catalog";

import { toProductWithCategory, type ProductJoinRow } from "./mappers";

/**
 * Read access to the product catalog for server-rendered pages.
 *
 * The visibility rule is `is_active = TRUE AND deleted_at IS NULL`, matching
 * models/productModel.js exactly — a soft-deleted product keeps its row for
 * order history but must never reappear on the storefront. It is applied in one
 * constant below so a new query cannot quietly omit half of it.
 */

/** Every storefront query is scoped by this. Never inline a partial copy. */
const VISIBLE = "p.is_active = TRUE AND p.deleted_at IS NULL";

const SELECT_WITH_CATEGORY = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id`;

export interface ProductListOptions {
  /** Restrict to one category by slug. Omit for the whole catalog. */
  categorySlug?: string | undefined;
  limit?: number;
  offset?: number;
}

/** Caps how many rows a single request can pull, whatever the caller asks for. */
const MAX_LIMIT = 60;

const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(Number(limit) || 12, 1), MAX_LIMIT);

export const listProducts = async ({
  categorySlug,
  limit,
  offset = 0,
}: ProductListOptions = {}): Promise<ProductWithCategory[]> => {
  const conditions = [VISIBLE];
  const params: (string | number)[] = [];

  if (categorySlug) {
    conditions.push("c.slug = ?");
    params.push(categorySlug);
  }

  const rows = await queryRows<ProductJoinRow>(
    `${SELECT_WITH_CATEGORY}
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, clampLimit(limit), Math.max(Number(offset) || 0, 0)],
  );

  return rows.map(toProductWithCategory);
};

export const countProducts = async (categorySlug?: string): Promise<number> => {
  const conditions = [VISIBLE];
  const params: string[] = [];

  if (categorySlug) {
    conditions.push("c.slug = ?");
    params.push(categorySlug);
  }

  const total = await queryScalar<number>(
    `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return Number(total ?? 0);
};

export const getProductById = async (id: number): Promise<ProductWithCategory | null> => {
  if (!Number.isInteger(id) || id < 1) return null;

  const row = await queryOne<ProductJoinRow>(
    `${SELECT_WITH_CATEGORY} WHERE p.id = ? AND ${VISIBLE} LIMIT 1`,
    [id],
  );

  return row ? toProductWithCategory(row) : null;
};

export const getProductBySlug = async (slug: string): Promise<ProductWithCategory | null> => {
  if (!slug) return null;

  const row = await queryOne<ProductJoinRow>(
    `${SELECT_WITH_CATEGORY} WHERE p.slug = ? AND ${VISIBLE} LIMIT 1`,
    [slug],
  );

  return row ? toProductWithCategory(row) : null;
};

export const listFeaturedProducts = async (limit = 8): Promise<ProductWithCategory[]> => {
  const rows = await queryRows<ProductJoinRow>(
    `${SELECT_WITH_CATEGORY}
      WHERE p.is_featured = TRUE AND ${VISIBLE}
      ORDER BY p.created_at DESC
      LIMIT ?`,
    [clampLimit(limit)],
  );

  return rows.map(toProductWithCategory);
};

/**
 * Related products from the same category, excluding the one being viewed.
 * Falls back to nothing rather than to unrelated stock — an empty rail is
 * better than a misleading one.
 */
export const listRelatedProducts = async (
  product: Pick<ProductWithCategory, "id" | "categoryId">,
  limit = 4,
): Promise<ProductWithCategory[]> => {
  if (product.categoryId === null) return [];

  const rows = await queryRows<ProductJoinRow>(
    `${SELECT_WITH_CATEGORY}
      WHERE p.category_id = ? AND p.id <> ? AND ${VISIBLE}
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT ?`,
    [product.categoryId, product.id, clampLimit(limit)],
  );

  return rows.map(toProductWithCategory);
};

/** Slugs and ids for sitemap and static-params generation. */
export const listProductIdentifiers = async (): Promise<
  { id: number; slug: string; updatedAt: Date }[]
> => {
  const rows = await queryRows<{ id: number; slug: string; updated_at: Date }>(
    `SELECT p.id, p.slug, p.updated_at FROM products p WHERE ${VISIBLE} ORDER BY p.id ASC`,
  );

  return rows.map((row) => ({ id: row.id, slug: row.slug, updatedAt: row.updated_at }));
};
