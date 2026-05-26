const PRODUCT_CONTENT_DEFAULTS = [
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

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const textIncludesAny = (text, values = []) => {
  return values.some((value) => {
    const normalizedValue = normalizeText(value);
    return normalizedValue && text.includes(normalizedValue);
  });
};

const getProductContentDefaults = (product = {}) => {
  const slug = normalizeText(product.slug);
  const name = normalizeText(product.name);
  const searchableText = [slug, name, normalizeText(product.category_name), normalizeText(product.category)]
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

const listToText = (value) => {
  return Array.isArray(value) ? value.join("\n") : null;
};

const fillMissingProductContent = (product = {}) => {
  const defaults = getProductContentDefaults(product);
  if (!defaults) {
    return {
      description: null,
      ingredients: null,
      benefits: null,
      usage: null,
    };
  }

  return {
    description: defaults.description || null,
    ingredients: listToText(defaults.ingredients),
    benefits: listToText(defaults.benefits),
    usage: listToText(defaults.usage),
  };
};

const backfillKnownProductContent = async (dbLike) => {
  const [rows] = await dbLike.query(
    "SELECT id, name, slug, description, ingredients, benefits, `usage` FROM products",
  );

  for (const row of rows) {
    const defaults = fillMissingProductContent(row);
    const fields = [];
    const params = [];

    if (!normalizeText(row.description) && defaults.description) {
      fields.push("description = ?");
      params.push(defaults.description);
    }

    if (!normalizeText(row.ingredients) && defaults.ingredients) {
      fields.push("ingredients = ?");
      params.push(defaults.ingredients);
    }

    if (!normalizeText(row.benefits) && defaults.benefits) {
      fields.push("benefits = ?");
      params.push(defaults.benefits);
    }

    if (!normalizeText(row.usage) && defaults.usage) {
      fields.push("`usage` = ?");
      params.push(defaults.usage);
    }

    if (!fields.length) {
      continue;
    }

    params.push(row.id);
    await dbLike.query(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, params);
  }
};

module.exports = {
  getProductContentDefaults,
  fillMissingProductContent,
  backfillKnownProductContent,
};
