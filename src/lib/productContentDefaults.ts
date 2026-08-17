/**
 * Fallback copy for products whose description/ingredients/benefits/usage
 * columns are still empty, ported from frontend/src/lib/productContentDefaults.js.
 *
 * Matching is deliberately fuzzy — slug and name are checked against known
 * spellings first, then a broader keyword sweep over slug + name + category —
 * because the same product has been entered under several names over time.
 * First entry in source order wins.
 *
 * ⚠ The lookup reads snake_case `category_name`, i.e. the raw API row shape,
 * NOT the mapped `Product`/`ProductWithCategory` domain type from
 * @/types/catalog (which spells it `categoryName`). Passing a mapped product
 * silently loses the category signal and falls back to slug/name matching only.
 */

export interface ProductContentMatchers {
  /** Matched against the slug alone, as a substring. */
  slugs?: readonly string[];
  /** Matched against the name alone, as a substring. */
  names?: readonly string[];
  /** Matched against slug + name + category text combined. */
  keywords?: readonly string[];
}

export interface ProductContentDefaults {
  matchers: ProductContentMatchers;
  description: string;
  ingredients: readonly string[];
  benefits: readonly string[];
  usage: readonly string[];
}

const PRODUCT_CONTENT_DEFAULTS: readonly ProductContentDefaults[] = [
  {
    matchers: {
      slugs: ["organic-honey", "honey"],
      names: ["organic honey", "honey"],
      keywords: ["honey"],
    },
    description:
      "Pure natural honey from mountain farms, carefully harvested to deliver rich taste and everyday wellness support.",
    ingredients: ["100% Pure Organic Honey"],
    benefits: [
      "Naturally rich in antioxidants and enzymes",
      "A soothing everyday sweetener for tea, toast, and warm drinks",
      "Supports a wholesome wellness routine with pure natural goodness",
    ],
    usage: [
      "Enjoy 1 to 2 teaspoons daily.",
      "Stir into tea, milk, smoothies, or drizzle over breakfast.",
      "Store in a cool, dry place away from direct sunlight.",
    ],
  },
  {
    matchers: {
      slugs: ["ispaghol", "ispaghol-husk", "psyllium", "psyllium-husk"],
      names: ["ispaghol", "psyllium husk", "psyllium"],
      keywords: ["ispaghol", "psyllium"],
    },
    description:
      "Natural ispaghol husk fiber that supports digestive comfort, gentle regularity, and daily gut wellness.",
    ingredients: ["100% Pure Ispaghol Husk (Psyllium Fiber)"],
    benefits: [
      "Helps support digestive comfort and regularity",
      "A convenient source of natural dietary fiber",
      "Fits easily into a simple daily wellness routine",
    ],
    usage: [
      "Mix 1 to 2 teaspoons in a glass of water, milk, or juice.",
      "Drink immediately and follow with another glass of water.",
      "Use once daily or as directed by your healthcare professional.",
    ],
  },
  {
    matchers: {
      slugs: ["organic-coconut-oil", "coconut-oil", "coconut-oil-1"],
      names: ["organic coconut oil", "coconut oil"],
      keywords: ["coconut", "oil"],
    },
    description:
      "Cold-pressed virgin coconut oil for cooking, skincare, and hair care with clean, versatile everyday use.",
    ingredients: ["100% Organic Virgin Coconut Oil"],
    benefits: [
      "A multi-purpose staple for kitchen and self-care routines",
      "Helps nourish skin and hair with natural moisture",
      "Smooth texture and clean aroma for daily use",
    ],
    usage: [
      "Use in cooking, baking, or light sauteing.",
      "Apply a small amount to skin or hair as needed.",
      "Store in a cool, dry place with the lid tightly closed.",
    ],
  },
];

const normalizeText = (value?: string | null): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const textIncludesAny = (
  text: string,
  values: readonly string[] = [],
): boolean => {
  return values.some((value) => {
    const normalizedValue = normalizeText(value);
    return Boolean(normalizedValue) && text.includes(normalizedValue);
  });
};

/** The raw product fields the matcher reads. Snake_case — see the file header. */
export interface ProductContentSource {
  slug?: string | null;
  name?: string | null;
  category_name?: string | null;
  category?: string | null;
}

/** The first defaults entry matching this product, or null if none do. */
export const getProductContentDefaults = (
  product: ProductContentSource | null | undefined,
): ProductContentDefaults | null => {
  if (!product) return null;
  const slug = normalizeText(product.slug);
  const name = normalizeText(product.name);
  const searchableText = [
    slug,
    name,
    normalizeText(product.category_name),
    normalizeText(product.category),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    PRODUCT_CONTENT_DEFAULTS.find((entry) => {
      const matchers = entry.matchers || {};

      if (textIncludesAny(slug, matchers.slugs)) {
        return true;
      }

      if (textIncludesAny(name, matchers.names)) {
        return true;
      }

      return textIncludesAny(searchableText, matchers.keywords);
    }) || null
  );
};

/**
 * Renders one of the list fields as newline-separated text, for the textareas
 * the admin form uses. Anything that is not an array becomes "".
 */
export const getProductContentText = (value: unknown): string => {
  return Array.isArray(value) ? (value as unknown[]).join("\n") : "";
};
