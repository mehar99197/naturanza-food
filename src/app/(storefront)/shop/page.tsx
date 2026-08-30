import type { Metadata } from "next";

import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { buildCategoryRefs, filterByCategory } from "@/components/shop/filtering";
import { ALL_CATEGORY_ID } from "@/components/shop/types";
import { JsonLdScript } from "@/components/seo/JsonLdScript";

import { buildShopJsonLd } from "./jsonLd";
import { buildShopMetadata, resolveShopSeo } from "./seo";
import { loadShopData } from "./shopData";

/**
 * /shop — the catalog, rendered on the server.
 *
 * The Vite page shipped an empty shell, fetched every product from the browser
 * and filtered them there, so the most commercially important URL on the site
 * showed a crawler no products, no prices and no links to any product page.
 * Everything is in the first response now: the catalog is read here, handed to
 * the client island as a prop, and pre-rendered into HTML alongside an ItemList
 * describing exactly what is on the page.
 *
 * WHAT IS STILL CLIENT STATE. Only the category is addressable — `?category=<id>`
 * here, `/shop/<slug>` on the sibling route. Sort, view mode, price range and
 * the search box were component state in the SPA and stay component state, so
 * the server always renders the same first view: every product, newest first.
 * See useShopFilters for the reasoning.
 *
 * Rendering is dynamic rather than cached. Prices, stock and the store-wide
 * sale all change from the admin panel, and the SPA re-fetched the catalog on
 * every mount and re-polled its categories every 30 seconds — a cached shop
 * would be the one visible regression this migration could introduce. There is
 * deliberately no `generateStaticParams` on the category route either, for the
 * same reason.
 */

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/shop";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/shop` always describes itself as the full catalog.
 *
 * `?category=` is a browser-side refinement of this page, not a page of its
 * own — it carries a numeric id, not a slug, so it has no title of its own to
 * offer and no business being indexed separately. The canonical therefore stays
 * `/shop` for every query string, which also corrects the SPA's canonical of
 * `/shop/<id>` (a URL that has never existed). See ./seo.
 */
export function generateMetadata(): Metadata {
  return buildShopMetadata({ categorySlug: null, canonicalPath: CANONICAL_PATH });
}

/** First value of a query parameter, ignoring repeats. */
const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedCategory = firstValue(resolvedSearchParams.category) || ALL_CATEGORY_ID;

  const { products, categories, productsError } = await loadShopData();

  // The island will narrow the grid to `?category=` in the browser, so the
  // ItemList is narrowed the same way here — through the same predicate — and
  // the structured data cannot advertise products the page does not show.
  const listedProducts = filterByCategory(
    products,
    requestedCategory,
    buildCategoryRefs(categories),
  );

  const jsonLd = buildShopJsonLd({
    products: listedProducts,
    listName: resolveShopSeo(null).title,
    categorySlug: null,
  });

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <ShopBrowser
        products={products}
        categories={categories}
        productsError={productsError}
      />
    </>
  );
}
