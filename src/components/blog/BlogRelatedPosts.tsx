import Link from "next/link";

import type { BlogPostSummary } from "@/types/blog";

import { ImageWithFallback } from "./ImageWithFallback";
import { BLOG_FALLBACK_IMAGE, blogImageSrc } from "./postFields";

/** "Related Articles" beneath the newsletter box, unchanged from BlogPost.jsx. */
export function BlogRelatedPosts({ posts }: { posts: BlogPostSummary[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="mb-5 text-xl font-bold text-[#2d3a2d]">Related Articles</h3>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="w-28 shrink-0 overflow-hidden">
              {post.imageUrl ? (
                <ImageWithFallback
                  src={blogImageSrc(post.imageUrl)}
                  alt={post.title}
                  lazy
                  className="h-full w-full object-contain p-2"
                  fallbackSrc={BLOG_FALLBACK_IMAGE}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-100 to-emerald-50">
                  <span className="text-2xl">🌿</span>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center p-4 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">
                {post.category}
              </span>
              <h4 className="mt-1 text-sm font-semibold text-slate-800 transition-colors group-hover:text-green-700 line-clamp-2">
                {post.title}
              </h4>
              {post.excerpt && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{post.excerpt}</p>
              )}
              <span className="mt-2 text-xs text-slate-400">{post.readTime}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
