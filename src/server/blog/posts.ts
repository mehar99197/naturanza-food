import "server-only";

import { queryOne, queryRows, queryScalar } from "@/server/db/query";
import type { BlogPost, BlogPostRow, BlogPostSummary } from "@/types/blog";

/**
 * Read access to blog posts for server-rendered pages.
 *
 * Listing queries name their columns instead of using `SELECT *`: `content` is
 * LONGTEXT, and pulling every post's body to render an index of excerpts is the
 * kind of query that looks fine on a seed database and degrades as the blog
 * grows.
 */

const VISIBLE = "is_published = TRUE";

const SUMMARY_COLUMNS = `id, slug, title, excerpt, author, category, image_url,
  read_time, keywords, featured, published_at, updated_at`;

const toKeywords = (value: string | null): string[] =>
  (value ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

const toSummary = (row: Omit<BlogPostRow, "content" | "is_published" | "created_at">): BlogPostSummary => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  author: row.author,
  category: row.category,
  imageUrl: row.image_url,
  readTime: row.read_time,
  keywords: toKeywords(row.keywords),
  isFeatured: row.featured === 1,
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

const toPost = (row: BlogPostRow): BlogPost => ({
  ...toSummary(row),
  content: row.content,
});

export interface BlogListOptions {
  category?: string | undefined;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 50;

const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(Number(limit) || 12, 1), MAX_LIMIT);

export const listPosts = async ({
  category,
  limit,
  offset = 0,
}: BlogListOptions = {}): Promise<BlogPostSummary[]> => {
  const conditions = [VISIBLE];
  const params: (string | number)[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const rows = await queryRows<BlogPostRow>(
    `SELECT ${SUMMARY_COLUMNS}
       FROM blog_posts
      WHERE ${conditions.join(" AND ")}
      ORDER BY published_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...params, clampLimit(limit), Math.max(Number(offset) || 0, 0)],
  );

  return rows.map(toSummary);
};

export const countPosts = async (category?: string): Promise<number> => {
  const conditions = [VISIBLE];
  const params: string[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const total = await queryScalar<number>(
    `SELECT COUNT(*) AS total FROM blog_posts WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return Number(total ?? 0);
};

export const getPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  if (!slug) return null;

  const row = await queryOne<BlogPostRow>(
    `SELECT * FROM blog_posts WHERE slug = ? AND ${VISIBLE} LIMIT 1`,
    [slug],
  );

  return row ? toPost(row) : null;
};

/** Other posts to read next, preferring the same category. */
export const listRelatedPosts = async (
  post: Pick<BlogPost, "id" | "category">,
  limit = 3,
): Promise<BlogPostSummary[]> => {
  const rows = await queryRows<BlogPostRow>(
    `SELECT ${SUMMARY_COLUMNS}
       FROM blog_posts
      WHERE ${VISIBLE} AND id <> ?
      ORDER BY (category <=> ?) DESC, published_at DESC
      LIMIT ?`,
    [post.id, post.category, clampLimit(limit)],
  );

  return rows.map(toSummary);
};

export const listPostCategories = async (): Promise<string[]> => {
  const rows = await queryRows<{ category: string | null }>(
    `SELECT DISTINCT category FROM blog_posts
      WHERE ${VISIBLE} AND category IS NOT NULL AND category <> ''
      ORDER BY category ASC`,
  );

  return rows.flatMap((row) => (row.category ? [row.category] : []));
};

/** Slugs for sitemap and static-params generation. */
export const listPostSlugs = async (): Promise<{ slug: string; updatedAt: Date }[]> => {
  const rows = await queryRows<{ slug: string; updated_at: Date }>(
    `SELECT slug, updated_at FROM blog_posts WHERE ${VISIBLE} ORDER BY published_at DESC`,
  );

  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
};
