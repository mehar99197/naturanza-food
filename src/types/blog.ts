import type { MySqlBool } from "./catalog";

/** Blog domain types. Row shape mirrors `blog_posts`; see ./catalog for the convention. */
export interface BlogPostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  author: string;
  category: string | null;
  image_url: string | null;
  read_time: string | null;
  keywords: string | null;
  featured: MySqlBool;
  is_published: MySqlBool;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Markdown. Rendered server-side and sanitised before it reaches the DOM. */
  content: string;
  author: string;
  category: string | null;
  imageUrl: string | null;
  readTime: string | null;
  /** Comma-separated in the column; split for the keywords meta tag. */
  keywords: string[];
  isFeatured: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

/** The listing shape — identical minus the body, which the index never needs. */
export type BlogPostSummary = Omit<BlogPost, "content">;
