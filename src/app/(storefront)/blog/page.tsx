import type { Metadata } from "next";
import { Newspaper } from "lucide-react";

import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";
import { BlogFeaturedPosts } from "@/components/blog/BlogFeaturedPosts";
import { BlogHero } from "@/components/blog/BlogHero";
import { toCardPost } from "@/components/blog/postFields";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DEFAULT_OG_IMAGE, LOCALE, SITE_NAME, SITE_URL } from "@/config/site";
import { listPosts } from "@/server/blog/posts";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/server/seo/jsonLd";

/**
 * /blog — the article index, rendered on the server.
 *
 * The Vite page shipped an empty div and fetched the post list from the browser,
 * so a crawler's first look at this URL contained no articles and no links to
 * any. Everything below is in the HTML response instead.
 */

const PAGE_TITLE = "Blog";

const PAGE_DESCRIPTION =
  "Expert articles on pure honey, ispaghol husk, digestive health, and natural living " +
  "from Naturanza Food — Pakistan's trusted organic store.";

const PAGE_KEYWORDS = [
  "organic food blog Pakistan",
  "honey benefits",
  "ispaghol husk",
  "digestive health",
  "natural products",
];

const CANONICAL_PATH = "/blog";

/**
 * The listing's ceiling, which is `listPosts`' own `MAX_LIMIT`.
 *
 * The old page asked the API for every published post. Here the query is
 * bounded, which is the right default for a page that will not paginate — but it
 * does mean a blog past fifty posts needs pagination adding rather than this
 * number raising.
 */
const MAX_POSTS = 50;

/**
 * Rendered per request, deliberately — this page must not be prerendered.
 *
 * `npm run build:next` runs from `postinstall` during a Hostinger deploy, and
 * that hook does not reliably see the Passenger app's database environment. The
 * sibling [slug] route already accounts for this: its generateStaticParams
 * swallows the failure and returns [] so the build still finishes. This page had
 * no such guard — with `revalidate` and an unguarded `listPosts()` it was
 * prerendered at build time, so an unreachable database threw, `next build`
 * failed, and postinstall died *after* `preinstall` had already run
 * `rm -rf node_modules`. That is a broken storefront, not a failed deploy.
 *
 * A try/catch would be worse than useless here: it would let the build succeed
 * and cache an empty blog index for the revalidate window, turning a loud
 * failure into a silent one.
 *
 * The cost is one bounded, indexed query per view of the index. The SPA it
 * replaces made the same query per view and paid a client round-trip on top, so
 * this is still strictly faster — and it makes the build independent of the
 * database, which is what lets the deploy be safe to repeat.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: PAGE_KEYWORDS,
  alternates: { canonical: CANONICAL_PATH },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: LOCALE,
    url: `${SITE_URL}${CANONICAL_PATH}`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, alt: `${SITE_NAME} Blog` }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function BlogPage() {
  const posts = await listPosts({ limit: MAX_POSTS });
  const cards = posts.map(toCardPost);
  const featured = posts.filter((post) => post.isFeatured).map(toCardPost);

  const jsonLd = [
    buildItemListJsonLd(
      posts.map((post) => ({ name: post.title, path: `/blog/${post.slug}` })),
      `${SITE_NAME} Blog`,
    ),
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: CANONICAL_PATH },
    ]),
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <main className="pt-20 sm:pt-24 pb-14 min-h-screen bg-[#faf8f3]">
        <div className="container-custom">
          {/* Hero */}
          <BlogHero postCount={posts.length} />

          {posts.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-green-100 bg-white p-12 text-center text-slate-500">
              <Newspaper className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-700">No articles yet</p>
              <p className="mt-1 text-sm">Check back soon for tips and guides.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              <BlogFeaturedPosts posts={featured} />

              {/* Category filter + all posts */}
              <BlogCategoryFilter posts={cards} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
