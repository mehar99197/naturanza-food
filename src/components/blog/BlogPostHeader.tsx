import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";

import type { BlogPost } from "@/types/blog";

import { BlogShareActions } from "./BlogShare";
import { authorInitial, formatPostDate } from "./postFields";
import { ReadingProgressBadge } from "./ReadingProgress";

/**
 * The green masthead above the article, unchanged from BlogPost.jsx.
 *
 * A Server Component: the title, byline, date and read time are the parts a
 * crawler cares about and they are now in the HTML. Only the two fragments that
 * genuinely react to the reader — the share controls and the "% read" pill — are
 * Client Components nested inside it.
 */
export function BlogPostHeader({ post, waUrl }: { post: BlogPost; waUrl: string }) {
  return (
    <div className="relative bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 text-white pt-24 sm:pt-28 pb-20 sm:pb-28 overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      <div className="container-custom relative">
        {/* Back + share row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Blog
          </Link>
          {/* Share buttons */}
          <BlogShareActions waUrl={waUrl} />
        </div>

        {/* Title block */}
        <div className="mt-5 max-w-3xl">
          {post.category && (
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              {post.category}
            </span>
          )}
          <h1 className="mt-3 font-display text-2xl sm:text-3xl md:text-[2.6rem] md:leading-tight font-bold">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/95">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-sm font-bold text-white ring-2 ring-white/40 shadow-sm">
                {authorInitial(post.author)}
              </span>
              <span className="font-medium">{post.author}</span>
            </span>
            <span className="text-white/40">·</span>
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <CalendarDays className="h-3.5 w-3.5" /> {formatPostDate(post.publishedAt)}
            </span>
            <span className="text-white/40">·</span>
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <Clock3 className="h-3.5 w-3.5" /> {post.readTime}
            </span>
            <ReadingProgressBadge />
          </div>
        </div>
      </div>
    </div>
  );
}
