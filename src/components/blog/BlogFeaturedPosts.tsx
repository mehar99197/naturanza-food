import Link from "next/link";

import { BlogCoverImage } from "./BlogCoverImage";
import { BlogMetaRow } from "./BlogMetaRow";
import type { BlogCardPost } from "./postFields";

/**
 * The two-up "Featured Articles" band, unchanged from Blog.jsx.
 *
 * A Server Component, and it stays one: the category filter below it never
 * touched this band, so none of it needs to reach the browser as JavaScript.
 */
export function BlogFeaturedPosts({ posts }: { posts: BlogCardPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-12">
      <h2 className="mb-5 text-xl sm:text-2xl font-bold text-[#2d3a2d]">Featured Articles</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <BlogCoverImage post={post} className="h-52 w-full" emojiClass="text-6xl" />
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <span className="text-xs font-bold uppercase tracking-wide text-green-600">
                {post.category}
              </span>
              <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 transition-colors group-hover:text-green-700 line-clamp-2">
                {post.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-2">{post.excerpt}</p>
              <BlogMetaRow post={post} className="mt-4" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
