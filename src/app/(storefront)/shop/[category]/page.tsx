import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { buildCategoryRefs, filterByCategory } from "@/components/shop/filtering";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { getCategoryBySlug } from "@/server/catalog/categories";

import { buildShopJsonLd } from "../jsonLd";
import { buildShopMetadata, resolveShopSeo } from "../seo";
import { loadShopData } from "../shopData";

/**
 * /shop/[category] — the catalog narrowed to one category, rendered on the
 * server.
 *
 * ONE DELIBERATE BEHAVIOUR CHANGE: an unknown slug now 404s. The SPA rendered
 * the full shop chrome and an empty grid with a 200, so every typo, every
 * retired category and every crawler guess became an indexable page that said
 * "0 products in All Products". `notFound()` is the correct answer and is the
 * only change to behaviour on this route.
 *
 * NOT changed, though it is tempting: the sidebar cannot switch category from
 * here. Shop.jsx resolved the selection as `pathCategory || searchParams.get(...)`,
 * so the path always won and a sidebar click only rewrote a query parameter
 * nothing then read. Reproduced exactly — see the report.
 *
 * The island still receives the *whole* catalog, not just this category's
 * products, because the sidebar's per-category counts are computed from the
 * loaded list. Sending a pre-filtered set would make every badge on the page
 * read as this category's size.
 */

export const dynamic = "force-dynamic";

/**
 * No `generateStaticParams`. Prerendering the category pages would bake in
 * prices, stock and the store-wide sale — all of which an admin changes from
 * the panel and expects to see live, which is why the SPA re-fetched on every
 * mount. Revisit together with a revalidation hook on the admin save path.
 */

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);

  // Metadata runs before the page body, so the unknown slug is answered here
  // too. Without it the 404 would inherit the site-wide title and invite
  // indexing of a page that does not exist.
  if (!category) {
    return { title: "Category Not Found", robots: { index: false, follow: false } };
  }

  return buildShopMetadata({
    categorySlug: category.slug,
    canonicalPath: `/shop/${category.slug}`,
  });
}

export default async function ShopCategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) notFound();

  const { products, categories, productsError } = await loadShopData();

  // The same predicate the browser runs, so the ItemList lists exactly the
  // cards the grid renders — including the keyword fallback that rescues the
  // launch categories whose products were never assigned a category_id.
  const listedProducts = filterByCategory(
    products,
    category.slug,
    buildCategoryRefs(categories),
  );

  const jsonLd = buildShopJsonLd({
    products: listedProducts,
    listName: resolveShopSeo(category.slug).title,
    categorySlug: category.slug,
  });

  return (
    <>
      <JsonLdScript data={jsonLd} />

      <ShopBrowser
        products={products}
        categories={categories}
        pathCategory={category.slug}
        productsError={productsError}
      />
    </>
  );
}
