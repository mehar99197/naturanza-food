import type {
  Category,
  CategoryRow,
  Product,
  ProductImage,
  ProductRow,
  ProductWithCategory,
} from "@/types/catalog";

/**
 * Row -> domain mapping.
 *
 * Everything that crosses from mysql2 into the app goes through here, so the
 * conversions that are easy to get wrong happen once: DECIMAL strings become
 * numbers, `0 | 1` becomes boolean, and the inventory columns are consumed to
 * produce `isInStock` and then dropped rather than carried along.
 */

const toBool = (value: 0 | 1 | boolean | null | undefined): boolean =>
  value === 1 || value === true;

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The `images` JSON column is unvalidated: it has held both plain URL strings
 * and objects across the app's history, so both are accepted and anything else
 * is discarded rather than rendered as "[object Object]".
 */
const toProductImages = (value: unknown): ProductImage[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ProductImage[] => {
    if (typeof entry === "string") {
      return entry ? [{ imageUrl: entry, altText: null }] : [];
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const imageUrl = typeof record.image_url === "string" ? record.image_url : null;
      const altText = typeof record.alt_text === "string" ? record.alt_text : null;
      return imageUrl ? [{ imageUrl, altText }] : [];
    }
    return [];
  });
};

export const toProduct = (row: ProductRow): Product => {
  const available = toNumber(row.stock_quantity) - toNumber(row.reserved_stock);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    barcode: row.barcode,
    description: row.description,
    ingredients: row.ingredients,
    benefits: row.benefits,
    usage: row.usage,
    price: toNumber(row.price),
    categoryId: row.category_id,
    imageUrl: row.image_url,
    images: toProductImages(row.images),
    isInStock: available > 0,
    isOrganic: toBool(row.is_organic),
    isFeatured: toBool(row.is_featured),
    discountPercentage: toNumber(row.discount_percentage),
  };
};

/** The shape the catalog JOINs return: a product row plus its category columns. */
export type ProductJoinRow = ProductRow & {
  category_name: string | null;
  category_slug: string | null;
};

export const toProductWithCategory = (row: ProductJoinRow): ProductWithCategory => ({
  ...toProduct(row),
  categoryName: row.category_name,
  categorySlug: row.category_slug,
});

export const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  imageUrl: row.image_url,
  placement: row.category_type,
});
