import { getProductContentDefaults } from './productContentDefaults.js';

export const DEFAULT_KEY_BENEFITS = [
  '100% Pure & Natural',
  'No Artificial Additives',
  'Hygienically Packed',
  'Nationwide Delivery',
];

const OXFORD_OR_CLAUSE_COMMA_RE = /,\s+(?:and|or)\b/i;

/**
 * Parses a product list field (ingredients, benefits, usage, image URLs) into a
 * clean array of non-empty strings without splitting full sentences on commas.
 *
 * - JS arrays and JSON array strings preserve each element intact.
 * - Multi-line or bullet-delimited text splits strictly on line/bullet markers,
 *   never on commas (so sentences like "Free from artificial dyes, fillers, and
 *   chemical preservatives" remain a single coherent bullet).
 * - Single-line text optionally splits on commas for simple tag-style admin
 *   entries (e.g. "Raw Honey, Roasted Almonds") unless `preserveClauses` detects
 *   a prose sentence with an Oxford comma.
 */
export const parseProductListField = (
  value,
  { allowSingleLineComma = true, preserveClauses = false } = {},
) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    if (normalized.startsWith('[') && normalized.endsWith(']')) {
      try {
        const parsed = JSON.parse(normalized);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        }
      } catch {
        // Fall through to plain-text parsing if bracketed text is not valid JSON.
      }
    }

    if (/[\n•\u2022]/.test(normalized)) {
      return normalized
        .split(/\n+|•|\u2022/)
        .map((item) => item.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean);
    }

    if (allowSingleLineComma && !(preserveClauses && OXFORD_OR_CLAUSE_COMMA_RE.test(normalized))) {
      return normalized
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [normalized];
  }

  return [];
};

export const resolveProductContent = (product) => {
  const defaults = getProductContentDefaults(product);

  const description =
    String(product?.description || '').trim() ||
    String(defaults?.description || '').trim();

  const productIngredients = parseProductListField(product?.ingredients, {
    allowSingleLineComma: true,
    preserveClauses: false,
  });
  const ingredients =
    productIngredients.length > 0
      ? productIngredients
      : parseProductListField(defaults?.ingredients, {
          allowSingleLineComma: false,
        });

  const productBenefits = parseProductListField(product?.benefits, {
    allowSingleLineComma: true,
    preserveClauses: true,
  });
  const benefits =
    productBenefits.length > 0
      ? productBenefits
      : parseProductListField(defaults?.benefits, {
          allowSingleLineComma: false,
        });

  const productUsage = parseProductListField(product?.usage, {
    allowSingleLineComma: false,
  });
  const usage =
    productUsage.length > 0
      ? productUsage
      : parseProductListField(defaults?.usage, {
          allowSingleLineComma: false,
        });

  const displayedBenefits = benefits.length > 0 ? benefits : DEFAULT_KEY_BENEFITS;
  const keyBenefits = displayedBenefits.slice(0, 6);
  const isCompactKeyBenefits =
    keyBenefits.length >= 4 && keyBenefits.every((item) => item.length <= 32);

  return {
    description,
    ingredients,
    benefits,
    displayedBenefits,
    keyBenefits,
    isCompactKeyBenefits,
    usage,
  };
};
