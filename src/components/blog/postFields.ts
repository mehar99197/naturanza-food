import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import type { BlogPostSummary } from "@/types/blog";

/**
 * The handful of derived values the blog pages read off a post.
 *
 * They exist because the Next pages read the database directly, where the old
 * pages read an API that had already shaped these fields — `image_url AS image`,
 * `read_time AS readTime`, and `DATE_FORMAT(published_at, '%Y-%m-%d') AS date`.
 * Reproducing the last of those faithfully matters most, and is the subtlest.
 */

/** Shown when a cover image 404s, as in the original. */
export const BLOG_FALLBACK_IMAGE = "/images/og-image.jpg";

/**
 * The published date exactly as the API used to spell it: `YYYY-MM-DD`.
 *
 * Built from the local-time getters, not `toISOString()`. mysql2 parses a
 * DATETIME into a Date in the connection's timezone, so the local getters read
 * back the digits MySQL stored; `toISOString()` would convert to UTC first and
 * silently shift a late-evening post to the previous day.
 *
 * Returns "" for an unpublished-but-visible row, where the old page rendered the
 * null `date` as nothing.
 */
export const formatPostDate = (publishedAt: Date | null): string => {
  if (!publishedAt) return "";

  const year = publishedAt.getFullYear();
  const month = String(publishedAt.getMonth() + 1).padStart(2, "0");
  const day = String(publishedAt.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/** Resolves a stored cover image to a URL, defaulting bare filenames to /images/blog. */
export const blogImageSrc = (imageUrl: string | null): string =>
  getAbsoluteImageUrl(imageUrl, { defaultFolder: "blog" });

/**
 * What a card needs, and nothing else.
 *
 * The category filter is a Client Component, so this crosses the server/client
 * boundary — which is why `date` is a string here rather than the `Date` the
 * query returns. Sending the Date would have the server format it in the
 * server's timezone and the browser reformat it in the reader's; where those
 * differ the two strings differ, and React discards the server HTML for that
 * subtree. Formatting once, on the server, makes the mismatch impossible.
 *
 * Trimming the body of the post to these fields also keeps the payload small:
 * `keywords`, `updatedAt` and the rest would otherwise be serialised into the
 * page for every card.
 */
export interface BlogCardPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  imageUrl: string | null;
  readTime: string | null;
  date: string;
}

export const toCardPost = (post: BlogPostSummary): BlogCardPost => ({
  id: post.id,
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  category: post.category,
  imageUrl: post.imageUrl,
  readTime: post.readTime,
  date: formatPostDate(post.publishedAt),
});

/** The avatar letter: first character of the author's name, "N" when absent. */
export const authorInitial = (author: string | null | undefined): string =>
  (String(author || "N").trim().charAt(0) || "N").toUpperCase();
