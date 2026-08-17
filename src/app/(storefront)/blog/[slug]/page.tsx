import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogArticleCard } from "@/components/blog/BlogArticleCard";
import { BlogAuthorBio } from "@/components/blog/BlogAuthorBio";
import { BlogNewsletterCta } from "@/components/blog/BlogNewsletterCta";
import { BlogPostHeader } from "@/components/blog/BlogPostHeader";
import { BlogRelatedPosts } from "@/components/blog/BlogRelatedPosts";
import { BlogShareCard } from "@/components/blog/BlogShare";
import { BlogShopCta } from "@/components/blog/BlogShopCta";
import { BlogTocList } from "@/components/blog/BlogTocList";
import { extractToc } from "@/components/blog/markdown/toc";
import { blogImageSrc } from "@/components/blog/postFields";
import { ReadingProgressBar } from "@/components/blog/ReadingProgress";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  LOCALE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/config/site";
import { getPostBySlug, listPostSlugs, listRelatedPosts } from "@/server/blog/posts";
import { buildBlogPostJsonLd, buildBreadcrumbJsonLd } from "@/server/seo/jsonLd";
import type { BlogPost } from "@/types/blog";

/**
 * /blog/[slug] — one article, rendered on the server.
 *
 * The route this replaces was the heaviest on the site: it fetched the post from
 * the browser and then turned its markdown into HTML there, with react-markdown
 * and remark-gfm. A crawler saw an empty shell; a reader on a phone waited for
 * ~174 kB of parser before the first paragraph appeared. Both now get the
 * finished article in the first response.
 */

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

/**
 * Pre-renders every published post at build time.
 *
 * The empty fallback is deliberate: `npm run build:next` runs from `postinstall`,
 * which can execute in an environment with no database reachable. Returning []
 * there costs the prerender but lets the build finish, and each page is then
 * generated on first request and cached — `dynamicParams` defaults to true, so a
 * post published after the build is served either way.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const slugs = await listPostSlugs();
    return slugs.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

/** Absolute cover URL, resolved through the blog folder before being made absolute. */
const coverUrl = (post: BlogPost): string =>
  post.imageUrl ? absoluteUrl(blogImageSrc(post.imageUrl)) : DEFAULT_OG_IMAGE;

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  // Metadata runs before the page body, so an unknown slug is answered here too.
  // Without this the 404 would inherit the site-wide title and invite indexing.
  if (!post) {
    return { title: "Post Not Found", robots: { index: false, follow: false } };
  }

  const description = post.excerpt || DEFAULT_DESCRIPTION;
  const canonicalPath = `/blog/${post.slug}`;
  const image = coverUrl(post);

  return {
    title: post.title,
    description,
    ...(post.keywords.length ? { keywords: post.keywords } : {}),
    authors: [{ name: post.author }],
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${canonicalPath}`,
      title: post.title,
      description,
      images: [{ url: image, alt: post.title }],
      authors: [post.author],
      ...(post.publishedAt ? { publishedTime: post.publishedAt.toISOString() } : {}),
      modifiedTime: post.updatedAt.toISOString(),
      ...(post.category ? { section: post.category } : {}),
      ...(post.keywords.length ? { tags: post.keywords } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  // A real 404, not the soft 200 the SPA returned for every unknown slug.
  // `getPostBySlug` filters on is_published, so an unpublished post 404s too.
  if (!post) notFound();

  const related = await listRelatedPosts(post, 3);
  const tocItems = extractToc(post.content);
  const hasToc = tocItems.length > 0;

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${post.title} — ${articleUrl}`)}`;

  const jsonLd = [
    buildBlogPostJsonLd(post, post.excerpt || DEFAULT_DESCRIPTION),
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />

      {/* Reading progress bar */}
      <ReadingProgressBar />

      <div className="min-h-screen bg-[#faf8f3]">
        {/* ── Green header ───────────────────────────────────────────────── */}
        <BlogPostHeader post={post} waUrl={waUrl} />

        {/* ── Content area ───────────────────────────────────────────────── */}
        <div className="container-custom pb-14">
          <div
            className={
              hasToc
                ? "lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10 lg:items-start"
                : "max-w-3xl mx-auto"
            }
          >
            {/* ── Article column ─────────────────────────────────────────── */}
            <div>
              <BlogArticleCard post={post} tocItems={tocItems} />
              <BlogAuthorBio author={post.author} />
              <BlogNewsletterCta sourceTitle={post.title} />
              <BlogRelatedPosts posts={related} />
              <BlogShopCta />
            </div>

            {/* ── TOC Sidebar (desktop only) ─────────────────────────────── */}
            {hasToc && (
              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-6">
                  {/* TOC */}
                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <BlogTocList items={tocItems} />
                  </div>

                  {/* Sidebar share */}
                  <BlogShareCard waUrl={waUrl} />
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
