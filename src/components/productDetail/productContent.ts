/**
 * Resolves the four copy sections the product page renders, ported from
 * frontend/src/pages/ProductDetail.jsx.
 *
 * Precedence is the product's own column first, then the curated defaults in
 * @/lib/productContentDefaults, then nothing. That order matters: an admin who
 * has written real ingredients must never be overwritten by the generic copy.
 *
 * The defaults matcher reads snake_case (`category_name`), while a Server
 * Component holds the mapped domain type (`categoryName`). The adapter below is
 * the single place that bridges the two — without it every product would miss
 * its category signal and fall back to slug/name matching alone.
 */

import {
  getProductContentDefaults,
  getProductContentText,
} from "@/lib/productContentDefaults";
import type { ProductWithCategory } from "@/types/catalog";

import { toArray, toParagraphs } from "./productText";

export interface ProductDetailContent {
  descriptionParagraphs: string[];
  ingredients: string[];
  benefits: string[];
  usage: string[];
}

type ContentSource = Pick<
  ProductWithCategory,
  "slug" | "name" | "categoryName" | "description" | "ingredients" | "benefits" | "usage"
>;

export const resolveDetailContent = (product: ContentSource): ProductDetailContent => {
  const defaults = getProductContentDefaults({
    slug: product.slug,
    name: product.name,
    category_name: product.categoryName,
  });

  const description = String(product.description || defaults?.description || "").trim();
  const ingredients = String(
    product.ingredients || getProductContentText(defaults?.ingredients) || "",
  ).trim();
  const benefits = String(
    product.benefits || getProductContentText(defaults?.benefits) || "",
  ).trim();
  const usage = String(product.usage || getProductContentText(defaults?.usage) || "").trim();

  return {
    descriptionParagraphs: toParagraphs(description),
    ingredients: toArray(ingredients),
    benefits: toArray(benefits),
    usage: toArray(usage),
  };
};
