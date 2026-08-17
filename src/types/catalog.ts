/**
 * Catalog domain types.
 *
 * `*Row` types mirror the MySQL table exactly — MySQL's own shapes, including
 * the `0 | 1` that mysql2 returns for BOOLEAN and the `string` it returns for
 * DECIMAL to avoid float rounding on money. The domain types are what the rest
 * of the app works with, after mapping. Keeping the two apart is what stops a
 * raw `"1"` or `"499.00"` reaching a component that expects a boolean or a
 * number.
 *
 * Note what `Product` does NOT carry: stock_quantity and reserved_stock. The
 * storefront has never exposed the inventory ledger — controllers/productController.js
 * strips both and publishes only `is_in_stock`. Keeping that shape in the type
 * means a page physically cannot render the numbers, rather than relying on
 * every author to remember not to.
 */

/** MySQL BOOLEAN comes back from mysql2 as 0 or 1, never true/false. */
export type MySqlBool = 0 | 1;

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  barcode: string | null;
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  usage: string | null;
  /** DECIMAL(10,2) — a string, to preserve exact paisa values. */
  price: string;
  category_id: number | null;
  image_url: string | null;
  images: unknown;
  stock_quantity: number;
  reserved_stock: number;
  is_organic: MySqlBool;
  is_featured: MySqlBool;
  is_active: MySqlBool;
  deleted_at: Date | null;
  discount_percentage: string;
  created_at: Date;
  updated_at: Date;
}

/** A product image as the storefront publishes it — URL and alt text only. */
export interface ProductImage {
  imageUrl: string | null;
  altText: string | null;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  /**
   * Retail barcode, published as Schema.org GTIN. Deliberately public so a
   * phone scan resolves to this page — see productController.js.
   */
  barcode: string | null;
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  usage: string | null;
  /** List price in rupees, before any discount. */
  price: number;
  categoryId: number | null;
  imageUrl: string | null;
  images: ProductImage[];
  /** The only inventory fact the storefront publishes. */
  isInStock: boolean;
  isOrganic: boolean;
  isFeatured: boolean;
  /** Product-level discount, 0–90. A store-wide sale can beat it; see pricing.ts. */
  discountPercentage: number;
}

/** A product joined with its category, as the shop and product pages need it. */
export interface ProductWithCategory extends Product {
  categoryName: string | null;
  categorySlug: string | null;
}

export type CategoryPlacement = "shop" | "shop_by_category" | "both";

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category_type: CategoryPlacement;
  is_active: MySqlBool;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  placement: CategoryPlacement;
}

/** A category carrying its live product count, for the shop filter rail. */
export interface CategoryWithCount extends Category {
  productCount: number;
}
