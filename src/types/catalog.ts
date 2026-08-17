/**
 * Catalog domain types.
 *
 * `*Row` types mirror the MySQL table exactly — MySQL's own shapes, including
 * the `0 | 1` that mysql2 returns for BOOLEAN and the `string` it returns for
 * DECIMAL to avoid float rounding on money. The plain types are what the rest of
 * the app works with, after mapping. Keeping the two apart is what stops a raw
 * `"1"` or `"499.00"` from reaching a component that expects a boolean or a
 * number.
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
  /** JSON column; mysql2 parses it, but the contents are unvalidated. */
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

export interface Product {
  id: number;
  name: string;
  slug: string;
  barcode: string | null;
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  usage: string | null;
  /** Rupees. Already a number — format at the edge, never re-parse. */
  price: number;
  categoryId: number | null;
  imageUrl: string | null;
  images: string[];
  stockQuantity: number;
  reservedStock: number;
  /** Stock minus outstanding COD holds — what a shopper can actually buy. */
  availableStock: number;
  isOrganic: boolean;
  isFeatured: boolean;
  discountPercentage: number;
  /** Price after any product-level discount, rounded to whole rupees. */
  salePrice: number;
  createdAt: Date;
  updatedAt: Date;
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
