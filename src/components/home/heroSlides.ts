import { getAbsoluteImageUrl } from "@/lib/imageUtils";

/**
 * Turning catalog rows into hero slides — the data half of Hero.jsx.
 *
 * Everything here is pure, so the carousel component is left with nothing but
 * state and markup. The rules are the source's, unchanged: honey first, three
 * repeating gradient/accent pairs, a 100-character description, and an image
 * guessed from the product name when the row carries none.
 */

/** Words the headline paints green. Matched case-insensitively, letters only. */
export const HIGHLIGHTED_HEADLINE_WORDS = new Set([
  'nourish',
  'natural',
  'pure',
  'organic',
  'herbal',
  'wellness',
  'coconut',
  'digestion',
  'ispaghol',
]);

export const FALLBACK_HERO_IMAGE = '/images/logo.png';

/** First match wins, so the order is meaningful — "coconut" outranks "oil". */
const NAME_KEYWORD_TO_IMAGE = [
  { keyword: 'honey', path: '/images/products/honey.webp' },
  { keyword: 'ispagh', path: '/images/products/ispaghol_2.webp' },
  { keyword: 'coconut', path: '/images/products/coconut-oil.webp' },
  { keyword: 'oil', path: '/images/products/oil.webp' },
  { keyword: 'herb', path: '/images/products/herbs.webp' },
  { keyword: 'tea', path: '/images/products/tea.webp' },
];

const guessImageFromName = (name: string): string | null => {
  const lower = String(name || '').toLowerCase();
  const hit = NAME_KEYWORD_TO_IMAGE.find(({ keyword }) => lower.includes(keyword));
  return hit ? hit.path : null;
};

export const resolveSlideImage = (image: string, productName: string): string => {
  if (image.trim()) {
    return getAbsoluteImageUrl(image.trim(), { defaultFolder: 'products' });
  }
  const guessed = guessImageFromName(productName);
  return guessed || FALLBACK_HERO_IMAGE;
};

const GRADIENTS = [
  "from-green-50 via-emerald-50 to-green-100",
  "from-emerald-50 via-green-50 to-teal-50",
  "from-green-100 via-emerald-50 to-green-50",
];

const ACCENTS = [
  "from-green-600 to-emerald-600",
  "from-emerald-600 to-green-700",
  "from-green-700 to-emerald-600",
];

/**
 * A product row as `GET /products` publishes it.
 *
 * Every field is optional and dual-typed because this is raw JSON, not the
 * mapped domain shape: DECIMAL columns arrive as strings, BOOLEAN columns as 0/1,
 * and three different spellings of the review count exist in the wild. The
 * source coerced all of it defensively and so does `toHeroSlides`.
 */
export interface HeroApiProduct {
  id?: number | string | null;
  product_id?: number | string | null;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  discount_percentage?: number | string | null;
  average_rating?: number | string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
  reviews_count?: number | string | null;
  reviewCount?: number | string | null;
  category_name?: string | null;
  category?: string | null;
  is_organic?: boolean | number | null;
  is_in_stock?: boolean | null;
  stock_quantity?: number | string | null;
  stock?: number | string | null;
  image?: string | null;
  image_url?: string | null;
}

export interface HeroSlideData {
  id: number | string;
  badge: string;
  headline: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
  linkPrimary: string;
  linkSecondary: string;
  image: string;
  bgGradient: string;
  accentColor: string;
  /** null when the row carried no usable price. */
  price: number | null;
  /** Snake_case on purpose: `getProductPricing` reads this spelling. */
  discount_percentage: number;
  rating: number;
  reviewCount: number;
  category: string;
  isOrganic: boolean;
  inStock: boolean;
}

const isHoneyProduct = (product: HeroApiProduct): boolean => {
  const text = `${product.name || ''} ${product.slug || ''}`.toLowerCase();
  return text.includes('honey');
};

/**
 * Honey products first, everything else in the order the API returned it.
 *
 * The decorate-sort-undecorate is the source's, and it matters: `Array#sort` is
 * only stable per spec since ES2019, and carrying the original index makes the
 * tie-break explicit rather than relying on the engine.
 */
export const sortHoneyFirst = (list: HeroApiProduct[]): HeroApiProduct[] =>
  list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const honeyDiff = Number(isHoneyProduct(b.item)) - Number(isHoneyProduct(a.item));
      if (honeyDiff !== 0) return honeyDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);

export const toHeroSlides = (list: HeroApiProduct[]): HeroSlideData[] =>
  list.map((p, idx) => {
    const numericPrice = Number(p.price);
    const ratingValue = Number(p.average_rating || p.rating || 0);
    const reviewCount = Number(p.review_count || p.reviews_count || p.reviewCount || 0);
    const categoryLabel = String(p.category_name || p.category || '').trim();
    const inStock =
      typeof p.is_in_stock === "boolean"
        ? p.is_in_stock
        : Number(p.stock_quantity ?? p.stock ?? 0) > 0;

    return {
      // `?? ''` only satisfies the type: a row with no id at all would already
      // have produced a `/product/undefined` link in the source.
      id: p.id ?? '',
      badge: "Featured",
      headline: String(p.name ?? ''),
      // Preserved as written: a hard 100-character cut with no ellipsis, so a
      // long description ends mid-word.
      description: p.description?.substring(0, 100) || "Discover our premium organic products.",
      ctaPrimary: "Shop Now",
      ctaSecondary: "Learn More",
      linkPrimary: `/product/${p.id ?? p.product_id ?? p.slug}`,
      linkSecondary: "/about",
      image: String(p.image || p.image_url || ""),
      bgGradient: GRADIENTS[idx % GRADIENTS.length] ?? '',
      accentColor: ACCENTS[idx % ACCENTS.length] ?? '',
      price: Number.isFinite(numericPrice) ? numericPrice : null,
      discount_percentage: Number(p.discount_percentage) || 0,
      rating: Number.isFinite(ratingValue) ? ratingValue : 0,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
      category: categoryLabel,
      isOrganic: p.is_organic === true || p.is_organic === 1,
      inStock,
    };
  });
