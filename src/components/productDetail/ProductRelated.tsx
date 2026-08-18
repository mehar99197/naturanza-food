import { ProductCard } from "@/components/product/ProductCard";
import type { ProductWithCategory } from "@/types/catalog";

/**
 * The "You May Also Like" rail — a snap-scrolling row on a phone, a grid on
 * desktop whose column count adapts to how many products there are.
 *
 * A Server Component: the cards themselves are Client Components (they own the
 * add-to-cart and wishlist buttons), but the list they render comes from the
 * database at request time rather than from a browser fetch.
 *
 * BEHAVIOUR NOTE, reported rather than changed: the SPA widened its search to
 * the whole catalog when a product's own category had nothing else in it, so an
 * unrelated product could appear under "You May Also Like".
 * `listRelatedProducts` returns an empty list instead and the rail disappears,
 * which is the documented behaviour of that module.
 */
export interface ProductRelatedProps {
  products: ProductWithCategory[];
}

/** Column count follows the number of products, so three do not leave a gap. */
const gridColumnsFor = (count: number): string => {
  if (count <= 2) return "md:grid-cols-2";
  if (count === 3) return "md:grid-cols-3";
  return "md:grid-cols-2 lg:grid-cols-4";
};

export function ProductRelated({ products }: ProductRelatedProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-8 md:mt-14">
      <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mb-4 md:mb-7">
        You May Also Like
      </h2>

      <div className="md:hidden scrollbar-hide flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {products.map((related) => (
          <div key={related.id} className="w-[230px] shrink-0 snap-center">
            <ProductCard product={related} />
          </div>
        ))}
      </div>

      <div className={`hidden md:grid gap-5 ${gridColumnsFor(products.length)}`}>
        {products.map((related) => (
          <ProductCard key={related.id} product={related} />
        ))}
      </div>
    </section>
  );
}
