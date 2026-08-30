import type { BlogPost } from "@/types/blog";

import { BlogMobileToc } from "./BlogMobileToc";
import { MarkdownContent } from "./markdown/MarkdownContent";
import type { TocItem } from "./markdown/toc";
import { ImageWithFallback } from "./ImageWithFallback";
import { BLOG_FALLBACK_IMAGE, blogImageSrc } from "./postFields";

/**
 * The white article card that overlaps the header, unchanged from BlogPost.jsx.
 *
 * This is where the migration pays off: `MarkdownContent` runs here, on the
 * server, so the body arrives as HTML. The Vite page did the same work in the
 * browser with react-markdown and remark-gfm — roughly 174 kB of JavaScript
 * downloaded, parsed and executed before the article existed to be read or
 * indexed.
 *
 * The cover keeps `object-contain` for the reason the original recorded: these
 * covers are product shots taller than the slot, so `cover` cropped the jar to a
 * middle band. The article is already white, so the letterboxing reads as
 * deliberate padding rather than a gap.
 */
export function BlogArticleCard({ post, tocItems }: { post: BlogPost; tocItems: TocItem[] }) {
  const coverImage = post.imageUrl ? blogImageSrc(post.imageUrl) : null;

  return (
    <article className="-mt-16 sm:-mt-24 bg-white rounded-2xl shadow-xl overflow-hidden mb-8 ring-1 ring-black/5">
      {coverImage && (
        <ImageWithFallback
          src={coverImage}
          alt={post.title}
          className="w-full h-60 sm:h-[380px] object-contain bg-white p-4"
          fallbackSrc={BLOG_FALLBACK_IMAGE}
        />
      )}
      <div className="p-6 sm:p-9">
        {/* Mobile TOC */}
        <BlogMobileToc items={tocItems} />

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg leading-relaxed text-slate-600 mb-7 pb-7 border-b border-gray-100">
            {post.excerpt}
          </p>
        )}

        {/* Main content */}
        <MarkdownContent source={post.content} />
      </div>
    </article>
  );
}
