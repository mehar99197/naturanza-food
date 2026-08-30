import Link from "next/link";

import { BlogCoverImage } from "./BlogCoverImage";
import { BlogMetaRow } from "./BlogMetaRow";
import type { BlogCardPost } from "./postFields";

/**
 * A card in the main grid, unchanged from Blog.jsx.
 *
 * `wide` is the original's `idx === 0 && filteredPosts.length >= 3` rule: the
 * first card of a grid with at least three entries spans two columns at the `sm`
 * breakpoint. It depends on the *filtered* list, which is why the grid could not
 * stay fully server-rendered once the filter kept its state in the browser.
 */
export function BlogPostCard({ post, wide }: { post: BlogCardPost; wide: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-green-200 ${
        wide ? "sm:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <div className="overflow-hidden">
        <BlogCoverImage
          post={post}
          className={`w-full transition-transform duration-500 group-hover:scale-105 ${
            wide ? "h-52 sm:h-64 lg:h-44" : "h-44"
          }`}
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">
          {post.category}
        </span>
        <h3 className="mt-1.5 text-base font-bold text-slate-900 transition-colors group-hover:text-green-700 line-clamp-2">
          {post.title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between">
          <BlogMetaRow post={post} />
          <span className="text-xs font-semibold text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}
