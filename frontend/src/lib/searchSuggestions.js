export const DEFAULT_POPULAR_SEARCHES = [
  "Honey",
  "Ispaghol",
  "Turmeric",
  "Red Chili",
  "Spices",
];

const TRAILING_PACK_SIZE_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|grams?|mg|ml|l|ltr|liters?|litres?|oz|lb|lbs|pcs?|pack|packs|capsules?|tablets?)\b/gi;

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const extractCleanProductSearchTerm = (rawName) => {
  const original = normalizeWhitespace(rawName);
  if (!original) return "";

  const withoutParens = original.replace(/\([^)]*\)/g, " ");
  const withoutSizes = withoutParens.replace(TRAILING_PACK_SIZE_PATTERN, " ");
  const cleaned = normalizeWhitespace(withoutSizes.replace(/^[-–—:,./]+|[-–—:,./]+$/g, ""));

  return cleaned || original;
};

const matchesAnyProduct = (products, term) => {
  const query = normalizeWhitespace(term).toLowerCase();
  if (!query) return false;

  return products.some((product) => {
    const name = String(product?.name || "").toLowerCase();
    const category = String(product?.category_name || product?.category || "").toLowerCase();
    const description = String(product?.description || "").toLowerCase();
    return name.includes(query) || category.includes(query) || description.includes(query);
  });
};

const isActiveProduct = (product) => {
  if (!product || typeof product !== "object") return false;
  if (product.deleted_at) return false;
  if (product.is_active === false || product.is_active === 0 || product.is_active === "0") {
    return false;
  }
  return Boolean(normalizeWhitespace(product.name) || normalizeWhitespace(product.category_name || product.category));
};

/**
 * Derive clickable Popular Search terms from the active product catalog so the
 * search modal never advertises categories or products the store does not sell.
 * Every returned term is guaranteed to match at least one active product under
 * Shop.jsx's search filter.
 */
export const buildPopularSearchTerms = (products, { limit = 5 } = {}) => {
  const maxTerms = Math.max(1, Number(limit) || 5);
  const activeProducts = Array.isArray(products) ? products.filter(isActiveProduct) : [];

  if (activeProducts.length === 0) {
    return DEFAULT_POPULAR_SEARCHES.slice(0, maxTerms);
  }

  const chosen = [];
  const seenLower = new Set();

  const tryAdd = (candidate) => {
    const term = normalizeWhitespace(candidate);
    if (!term || term.length < 2) return false;
    const lower = term.toLowerCase();
    if (seenLower.has(lower)) return false;
    if (!matchesAnyProduct(activeProducts, term)) return false;
    seenLower.add(lower);
    chosen.push(term);
    return true;
  };

  // Pass 1: unique active category names (e.g., Honey, Ispaghol, Spices)
  const categoryNames = [];
  const seenCategories = new Set();
  for (const product of activeProducts) {
    const cat = normalizeWhitespace(product.category_name || product.category);
    const catLower = cat.toLowerCase();
    if (cat && !seenCategories.has(catLower)) {
      seenCategories.add(catLower);
      categoryNames.push(cat);
    }
  }
  // Keep deterministic, customer-friendly ordering (alphabetical by category)
  categoryNames.sort((a, b) => a.localeCompare(b));
  for (const cat of categoryNames) {
    if (chosen.length >= maxTerms) break;
    tryAdd(cat);
  }

  // Pass 2: distinctive clean product terms not already containing an added category
  // (e.g., Turmeric, Red Chili under Spices)
  const cleanProductTerms = activeProducts
    .map((product) => extractCleanProductSearchTerm(product.name))
    .filter(Boolean);

  for (const term of cleanProductTerms) {
    if (chosen.length >= maxTerms) break;
    const lower = term.toLowerCase();
    const coveredByExisting = chosen.some((existing) => lower.includes(existing.toLowerCase()));
    if (!coveredByExisting) {
      tryAdd(term);
    }
  }

  // Pass 3: fill remaining slots (when catalog has few categories) with distinct product names
  for (const term of cleanProductTerms) {
    if (chosen.length >= maxTerms) break;
    tryAdd(term);
  }

  return chosen.length > 0 ? chosen : DEFAULT_POPULAR_SEARCHES.slice(0, maxTerms);
};
