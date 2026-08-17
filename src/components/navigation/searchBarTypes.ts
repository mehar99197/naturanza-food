/**
 * Shapes shared between SearchBar and its suggestions dropdown.
 *
 * In their own module so the two components can import them without either
 * depending on the other.
 */

import type { StoreDiscountSettings } from "@/lib/pricing";

/**
 * A product as the REST API publishes it — snake_case, and every field optional
 * because this component is handed whatever the caller happens to have loaded.
 */
export interface SearchBarProduct {
  id?: string | number;
  name?: string | null;
  description?: string | null;
  category_name?: string | null;
  category?: string | null;
  image_url?: string | null;
  image?: string | null;
  price?: number | string | null;
  discount_percentage?: number | string | null;
}

/**
 * The settings slice the suggestions read: the display currency, plus the
 * store-wide sale fields `getProductPricing` needs to work out a sale price.
 */
export interface SearchBarSettings extends Partial<StoreDiscountSettings> {
  currency: string;
}

/** Derived matches for the current query, capped at 6 products and 3 categories. */
export interface Suggestions {
  products: SearchBarProduct[];
  categories: string[];
}
