import "server-only";

import { listCategoriesWithCounts } from "@/server/catalog/categories";
import { getProductPricing } from "@/server/catalog/pricing";
import { listFeaturedProducts, listProducts } from "@/server/catalog/products";
import { queryScalar } from "@/server/db/query";
import { listPosts } from "@/server/blog/posts";
import { buildProductJsonLd } from "@/server/seo/jsonLd";

/**
 * The checks behind /render-check.
 *
 * They exercise the same modules the migrated pages use — pool, catalog, blog,
 * pricing and structured data — so a deploy can be verified without waiting for
 * a customer to load a real page. Kept out of the page component so the page
 * stays presentational and each concern is testable on its own.
 */
export interface Check {
  label: string;
  value: string;
  ok: boolean;
}

/** Runs one check, turning a thrown error into a failed row rather than a 500. */
const attempt = async (label: string, run: () => Promise<string>): Promise<Check> => {
  try {
    return { label, value: await run(), ok: true };
  } catch (error) {
    return { label, value: error instanceof Error ? error.message : "unknown error", ok: false };
  }
};

export const runChecks = async (): Promise<Check[]> =>
  Promise.all([
    attempt("Database pool", async () => {
      const version = await queryScalar<string>("SELECT VERSION() AS v");
      return `connected to ${version ?? "unknown"}`;
    }),

    attempt("Catalog read", async () => {
      const products = await listProducts({ limit: 5 });
      const featured = await listFeaturedProducts(5);
      return `${products.length} listed, ${featured.length} featured`;
    }),

    attempt("Category counts", async () => {
      const categories = await listCategoriesWithCounts();
      const total = categories.reduce((sum, category) => sum + category.productCount, 0);
      return `${categories.length} categories, ${total} products counted`;
    }),

    attempt("Blog read", async () => {
      const posts = await listPosts({ limit: 5 });
      return `${posts.length} published posts`;
    }),

    attempt("Pricing rules", async () => {
      // A fixed input, so the answer is a regression check and not a reflection
      // of whatever happens to be in the catalogue today.
      const { salePrice, effectivePct } = getProductPricing(
        { price: 1000, discountPercentage: 10 },
        { storeDiscountActive: true, storeDiscountPercentage: 25, storeDiscountLabel: "Sale" },
      );
      // Store-wide 25% beats the product's 10% and replaces it — never stacks.
      if (salePrice !== 750 || effectivePct !== 25) {
        throw new Error(`expected 750 at 25%, got ${salePrice} at ${effectivePct}%`);
      }
      return "store-wide sale overrides product discount correctly";
    }),

    attempt("Structured data", async () => {
      const [product] = await listProducts({ limit: 1 });
      if (!product) return "no products to describe";
      const jsonLd = buildProductJsonLd(product, "diagnostic");
      const offers = jsonLd.offers as { price?: string; availability?: string } | undefined;
      if (!offers?.price) throw new Error("product JSON-LD is missing an offer price");
      return `Product schema built (${offers.availability?.split("/").pop() ?? "unknown"})`;
    }),
  ]);
