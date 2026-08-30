import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegacyReviewStorageCleanup } from "@/components/productDetail/LegacyReviewStorageCleanup";
import { ProductAssuranceCards } from "@/components/productDetail/ProductAssuranceCards";
import { ProductBreadcrumbs } from "@/components/productDetail/ProductBreadcrumbs";
import { ProductDetailSectionContent } from "@/components/productDetail/ProductDetailSectionContent";
import { ProductGalleryDesktop } from "@/components/productDetail/ProductGalleryDesktop";
import { ProductGalleryMobile } from "@/components/productDetail/ProductGalleryMobile";
import { ProductInfoDesktop } from "@/components/productDetail/ProductInfoDesktop";
import { ProductInfoMobile } from "@/components/productDetail/ProductInfoMobile";
import { ProductMobileSections } from "@/components/productDetail/ProductMobileSections";
import { ProductOpenGraphMeta } from "@/components/productDetail/ProductOpenGraphMeta";
import { ProductRelated } from "@/components/productDetail/ProductRelated";
import { ProductTabs } from "@/components/productDetail/ProductTabs";
import type { DetailSectionKey } from "@/components/productDetail/constants";
import { getGalleryImages } from "@/components/productDetail/galleryImages";
import { resolveDetailContent } from "@/components/productDetail/productContent";
import { metaDescriptionFor } from "@/components/productDetail/productText";
import type { ProductRatingSummary } from "@/components/productDetail/types";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import {
  CURRENCY,
  DEFAULT_OG_IMAGE,
  LOCALE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/config/site";
import { getProductPricing } from "@/lib/pricing";
import { getProductById, listRelatedProducts } from "@/server/catalog/products";
import {
  REVIEWS_PAGE_SIZE,
  getReviewSummary,
  listProductReviews,
  type ReviewSummary,
} from "@/server/catalog/reviews";

import { buildProductPageJsonLd } from "./jsonLd";

/**
 * /product/[id] — the most SEO-important page on the site, rendered on the
 * server.
 *
 * The SPA shipped an empty shell here and then fetched the product, its
 * reviews, and its category siblings from the browser. A crawler that does not
 * run JavaScript saw no name, no price and no description; the only reason the
 * product was indexable at all was a second, hand-assembled copy of the markup
 * emitted by backend/utils/seoRenderer.js — which had drifted from what the
 * page actually showed. Now there is one renderer, and the title, description,
 * canonical, Open Graph image and Product JSON-LD are all in the first
 * response.
 *
 * Price and availability are therefore always current, which matters more here
 * than on any other route: the SPA served them from a stale catalog cache, so a
 * product could read "in stock" until the add-to-cart call failed.
 */

/**
 * Rendered per request, inherited from the storefront layout.
 *
 * This route previously used ISR (`revalidate = 300`). It cannot: the
 * Content-Security-Policy admits Next's inline hydration scripts by a
 * per-request nonce, so cached HTML would carry a nonce matching no later
 * response and the browser would block the scripts that hydrate the page.
 * See backend/csp.js and the storefront layout.
 */

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Deliberately no `generateStaticParams`.
 *
 * Prerendering this route would bake build-time HTML — including Next's inline
 * hydration scripts — into the output. Those scripts are admitted by a
 * per-request CSP nonce (backend/csp.js), so a build-time nonce matches no
 * later response and the browser blocks them: the page would render and then
 * fail to hydrate. Removing it also drops the build's last dependency on a
 * reachable database, which matters because `build:next` runs from
 * `postinstall`, after `preinstall` has already deleted node_modules.
 */

/**
 * The route is `/product/:id` and the API has only ever resolved numeric ids —
 * `productModel.findById` takes an integer, and there is no by-slug endpoint.
 * Anything else is a 404 rather than a query.
 */
const parseProductId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * `generateMetadata` and the page body both need the product, and Next calls
 * them separately. `cache` collapses that into one query per request.
 */
const loadProduct = cache(async (raw: string) => {
  const id = parseProductId(raw);
  return id === null ? null : getProductById(id);
});

/**
 * Site-wide keyword list, carried over verbatim from the SEO component's
 * DEFAULT_KEYWORDS. The SPA's product page passed no keywords of its own, so
 * this is exactly what it published.
 */
const DEFAULT_KEYWORDS = [
  "organic food Pakistan",
  "natural products",
  "organic honey",
  "herbal tea",
  "supplements",
  "wellness",
  "buy organic online Pakistan",
];

/**
 * Adapts the reviews module's summary to the two numbers the star row needs.
 *
 * `totalCount` is every approved review, not the page that was fetched, so the
 * "(N reviews)" label stays correct while only the first page is rendered. The
 * SPA counted the array it had, which happened to agree because it fetched them
 * all; this keeps agreeing now that it does not.
 *
 * The one place this page depends on `ReviewSummary`'s field names, kept
 * separate so a rename there is a one-line change here.
 */
const toRatingSummary = (summary: ReviewSummary): ProductRatingSummary => ({
  averageRating: summary.averageRating,
  reviewCount: summary.totalCount,
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  // Metadata resolves before the body, so an unknown id is answered here too —
  // otherwise the 404 would inherit the site-wide title and invite indexing.
  if (!product) {
    return { title: "Product Not Found", robots: { index: false, follow: false } };
  }

  const { descriptionParagraphs } = resolveDetailContent(product);
  const description = metaDescriptionFor(descriptionParagraphs, product.name);
  const canonicalPath = `/product/${product.id}`;
  // getGalleryImages never returns an empty list — it falls back to a category
  // stock photo — so the DEFAULT_OG_IMAGE branch exists only to satisfy
  // noUncheckedIndexedAccess.
  const [primaryImage] = getGalleryImages(product);
  const image = primaryImage ? absoluteUrl(primaryImage) : DEFAULT_OG_IMAGE;
  const fullTitle = `${product.name} | ${SITE_NAME}`;

  return {
    title: product.name,
    description,
    keywords: DEFAULT_KEYWORDS,
    alternates: { canonical: canonicalPath },
    // `type` is deliberately absent: Open Graph's "product" type is not in
    // Next's union, so ProductOpenGraphMeta emits it (and the product:* price
    // tags) as real `property` attributes. Leaving it out here is what stops a
    // second, contradicting og:type being written.
    openGraph: {
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${canonicalPath}`,
      title: fullTitle,
      description,
      images: [{ url: image, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await loadProduct(id);

  // A real 404. `getProductById` filters on is_active = TRUE AND deleted_at IS
  // NULL, so a withdrawn product lands here rather than rendering.
  if (!product) notFound();

  // One round trip each, in parallel. The reviews list is capped at
  // REVIEWS_PAGE_SIZE — the reviews section fetches the rest itself if a reader
  // expands it, so a product with hundreds of reviews does not inflate the HTML.
  const [related, reviews, reviewSummary] = await Promise.all([
    listRelatedProducts(product, 8),
    listProductReviews(product.id, REVIEWS_PAGE_SIZE),
    getReviewSummary(product.id),
  ]);

  const content = resolveDetailContent(product);
  const images = getGalleryImages(product);
  const summary = toRatingSummary(reviewSummary);
  const descriptionLead = content.descriptionParagraphs[0] ?? "";
  const metaDescription = metaDescriptionFor(content.descriptionParagraphs, product.name);

  // All four bodies are rendered here, on the server, and handed to the tab
  // strip and the accordion as nodes. Switching tabs is then a local state
  // change with no request and no client-side markup generation.
  const panelFor = (key: DetailSectionKey): ReactNode => (
    <ProductDetailSectionContent sectionKey={key} content={content} />
  );

  const panels: Record<DetailSectionKey, ReactNode> = {
    description: panelFor("description"),
    ingredients: panelFor("ingredients"),
    benefits: panelFor("benefits"),
    usage: panelFor("usage"),
  };

  // The price the customer pays, in the site's canonical currency. The same
  // figure the JSON-LD offer carries, by construction — both come from
  // getProductPricing, never from an inline recomputation.
  const { salePrice } = getProductPricing(product);

  return (
    <>
      <JsonLdScript data={buildProductPageJsonLd(product, metaDescription)} />
      <ProductOpenGraphMeta
        price={salePrice.toFixed(2)}
        currency={CURRENCY}
        availability={product.isInStock ? "in stock" : "out of stock"}
      />
      <LegacyReviewStorageCleanup />

      <div className="pt-20 md:pt-24 pb-10 md:pb-16 bg-gradient-to-b from-[#f8fbf8] via-white to-[#f6faf6] min-h-screen">
        <div className="container-custom">
          <ProductBreadcrumbs productName={product.name} />

          {/* ── Phone layout ───────────────────────────────────────────────── */}
          <section className="md:hidden space-y-4">
            <ProductGalleryMobile images={images} productName={product.name} />
            <ProductInfoMobile
              product={product}
              summary={summary}
              descriptionLead={descriptionLead}
            />
            <ProductMobileSections panels={panels} />
          </section>

          {/* ── Desktop layout ─────────────────────────────────────────────── */}
          <section className="hidden md:block">
            <div className="grid grid-cols-12 items-start gap-6 lg:gap-8">
              <div className="col-span-7">
                <ProductGalleryDesktop images={images} productName={product.name} />
                <ProductAssuranceCards />
              </div>

              <aside className="col-span-5">
                <ProductInfoDesktop
                  product={product}
                  summary={summary}
                  descriptionLead={descriptionLead}
                />
              </aside>
            </div>

            <ProductTabs panels={panels} />
          </section>

          <section className="mt-8 md:mt-12">
            <ProductReviews
              productId={product.id}
              initialReviews={reviews}
              initialSummary={reviewSummary}
            />
          </section>

          <ProductRelated products={related} />
        </div>
      </div>
    </>
  );
}
