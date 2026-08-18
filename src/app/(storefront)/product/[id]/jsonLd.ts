import { buildBreadcrumbJsonLd, buildProductJsonLd, type JsonLd } from "@/server/seo/jsonLd";
import type { ProductWithCategory } from "@/types/catalog";

/**
 * The structured data this page emits: one Product node and one BreadcrumbList.
 *
 * WHY THIS IS DIFFERENT FROM BEFORE. The SPA rendered only the breadcrumb here
 * and left the Product node to backend/utils/seoRenderer.js, because an earlier
 * client-side copy disagreed with the server's on sku, price type and
 * offers.url and produced two contradicting Product nodes. With the page itself
 * server-rendered there is one renderer and one node, so the duplication that
 * caused the split cannot recur.
 *
 * `buildProductJsonLd` is the shared builder. Two of its guarantees matter most
 * on this page and are the reason nothing is assembled by hand here:
 *
 *   offers.price is the post-discount figure, so the number a crawler reads is
 *   the number on the page. The old renderer published the undiscounted list
 *   price, which is a Merchant Center price-mismatch disapproval.
 *
 *   availability is derived from `isInStock`, which already subtracts reserved
 *   stock, so a product fully committed to pending orders no longer advertises
 *   InStock while its own page says otherwise.
 *
 * GTIN: the builder maps `barcode` to gtin8/gtin12/gtin13 by length. Whether
 * these codes are registered to this business is an open commercial question —
 * see the note in @/server/seo/jsonLd. Behaviour is carried over unchanged on
 * purpose.
 */
export const buildProductPageJsonLd = (
  product: ProductWithCategory,
  description: string,
): JsonLd[] => [
  buildProductJsonLd(product, description),
  buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: product.name, path: `/product/${product.id}` },
  ]),
];
