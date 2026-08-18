import type { Metadata } from "next";

import { Categories } from "@/components/home/Categories";
import { toCategoryCards } from "@/components/home/categoryCards";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Features } from "@/components/home/Features";
import { Hero } from "@/components/home/Hero";
import { HomeAbout } from "@/components/home/HomeAbout";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  LOCALE,
  SITE_NAME,
  SITE_URL,
} from "@/config/site";
import { listCategories } from "@/server/catalog/categories";
import { listFeaturedProducts, listProducts } from "@/server/catalog/products";

import { buildWebsiteJsonLd } from "./jsonLd";

/**
 * / — the home page, ported from frontend/src/pages/Home.jsx.
 *
 * The five sections are unchanged. What changed is where two of them get their
 * data: FeaturedProducts and Categories are read on the server and their markup
 * ships in the first response, where the SPA fetched both from the browser after
 * mount. That is the page's largest contentful paint and its only crawlable
 * product links, so both were worth moving. Hero still fetches client-side —
 * `@/components/home/Hero` explains why.
 *
 * `force-dynamic` rather than a revalidate window: the featured flag, prices and
 * the category list are all admin-editable, and the same choice is made on
 * /about for the same reason. It also keeps `next build` from needing a
 * reachable database.
 */
export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/";

/**
 * Ceiling on the rail, which is `listFeaturedProducts`' own MAX_LIMIT.
 *
 * The source rendered *every* featured product — the list came from a context
 * holding the whole catalog — so there is no smaller number that is faithful.
 * This is the closest bounded equivalent; a catalog that ever features more than
 * 60 products needs this rail paginating rather than this constant raising.
 */
const MAX_FEATURED = 60;

/**
 * Home is the one page whose title *is* the site default, so it inherits
 * `title.default` from the root layout rather than being templated. `absolute`
 * says that explicitly instead of relying on the absence of a key.
 *
 * ⚠ Two different home titles existed in the source. `HomeSEO` in SEO.jsx
 * produced "…Premium Organic & Natural Products in Pakistan" via react-helmet
 * after hydration, while the server-side prerenderer (backend/utils/seoRenderer.js,
 * route "/") and frontend/index.html both sent "…Premium Organic & Natural
 * Products | Buy Online in Pakistan" — which is what crawlers actually indexed,
 * and what @/config/site already codifies as DEFAULT_TITLE. The prerenderer's
 * string wins here so the migration does not introduce a third variant.
 * Everything else — description, keywords, canonical — is HomeSEO's, verbatim.
 */
export const metadata: Metadata = {
  title: { absolute: DEFAULT_TITLE },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "organic food Pakistan",
    "natural products",
    "buy organic honey",
    "herbal tea online Pakistan",
    "natural supplements",
    "organic store Karachi Lahore Islamabad",
  ],
  alternates: { canonical: CANONICAL_PATH },
  // openGraph and twitter replace the parent objects wholesale rather than
  // merging field by field, so every field is repeated here — including the
  // image, which would otherwise be dropped.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: LOCALE,
    url: `${SITE_URL}/`,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, alt: DEFAULT_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

/**
 * Featured products, or the newest active products when nothing is featured.
 *
 * The fallback is the source's, not an invention: `getFeaturedProducts()` in
 * ProductContext.jsx returned every active product when no product carried the
 * featured flag, which is why a fresh store still showed a full rail. Both
 * queries order by `created_at DESC` and share the same visibility rule, so the
 * two branches agree on everything except the flag.
 */
const loadFeaturedProducts = async () => {
  const featured = await listFeaturedProducts(MAX_FEATURED);
  if (featured.length > 0) return featured;
  return listProducts({ limit: MAX_FEATURED });
};

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    loadFeaturedProducts(),
    // 'shop_by_category' also matches categories marked 'both' — the same rule
    // categoryModel.js applies to `?category_type=shop_by_category`, which is
    // what the source requested.
    listCategories("shop_by_category"),
  ]);

  return (
    <>
      {/* Organization is emitted once per document by the storefront layout;
          this page adds only the WebSite node and its SearchAction. */}
      <JsonLdScript data={buildWebsiteJsonLd()} />

      {/* Home.jsx wrapped these sections in a second <main>. The layout already
          renders <main id="main-content">, and nesting one inside another is
          invalid HTML, so this is a <div> wearing the same two classes — the
          rendered appearance is unchanged. */}
      <div className="overflow-x-hidden bg-gradient-light">
        <Hero />
        <Features />
        <FeaturedProducts products={products} />
        <HomeAbout />
        <Categories categories={toCategoryCards(categories)} />
      </div>
    </>
  );
}
