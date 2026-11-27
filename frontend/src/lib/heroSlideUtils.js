import { getProductContentDefaults } from './productContentDefaults.js';

const GRADIENTS = [
  'from-green-50 via-emerald-50 to-green-100',
  'from-emerald-50 via-green-50 to-teal-50',
  'from-green-100 via-emerald-50 to-green-50',
];

const ACCENTS = [
  'from-green-600 to-emerald-600',
  'from-emerald-600 to-green-700',
  'from-green-700 to-emerald-600',
];

const isTruthyFlag = (value) => {
  if (value === true || value === 1) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const isExplicitlyFalseFlag = (value) => {
  if (value === false || value === 0) return true;
  if (value === undefined || value === null || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'false' || normalized === '0' || normalized === 'no';
};

export const isHoneyProduct = (product) => {
  const text = `${product?.name || ''} ${product?.slug || ''}`.toLowerCase();
  return text.includes('honey');
};

export const normalizeSlideHeadline = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const splitHeadlineWords = (headline) => {
  const normalized = normalizeSlideHeadline(headline);
  return normalized ? normalized.split(' ') : [];
};

/**
 * Truncates text cleanly on a word boundary so descriptions never cut mid-word
 * (e.g., "everyday welln" or "daily gut wellne"). Short descriptions are left intact.
 */
export const createCleanExcerpt = (text, maxLength = 155) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;

  const slice = clean.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > Math.floor(maxLength * 0.5) ? slice.slice(0, lastSpace) : slice.slice(0, maxLength - 1);
  return `${cut.replace(/[,;:\-\s]+$/, '')}\u2026`;
};

export const buildHeroSlides = (activeProducts = []) => {
  const list = (Array.isArray(activeProducts) ? activeProducts : [])
    .filter(
      (item) =>
        item &&
        (item.id !== undefined || item.product_id !== undefined) &&
        !isExplicitlyFalseFlag(item.show_in_hero),
    )
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const honeyDiff = Number(isHoneyProduct(b.item)) - Number(isHoneyProduct(a.item));
      if (honeyDiff !== 0) return honeyDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);

  return list.map((p, idx) => {
    const numericPrice = Number(p?.price);
    const ratingValue = Number(p?.average_rating ?? p?.averageRating ?? p?.rating ?? 0);
    const reviewCount = Number(p?.review_count ?? p?.reviews_count ?? p?.reviewCount ?? 0);
    const categoryLabel = String(p?.category_name || p?.category || '').trim();
    const inStock =
      typeof p?.is_in_stock === 'boolean'
        ? p.is_in_stock
        : Number(p?.stock_quantity ?? p?.stock ?? 0) > 0;
    const isFeatured = isTruthyFlag(p?.is_featured);
    const headline = normalizeSlideHeadline(p?.name) || 'Organic Product';
    const rawDescription =
      String(p?.description || '').trim() ||
      getProductContentDefaults(p)?.description ||
      'Discover our 100% pure, naturally sourced organic wellness products.';

    return {
      id: p.id ?? p.product_id,
      badge: String(p?.badge || '').trim() || (isFeatured ? 'Featured' : categoryLabel || 'Organic'),
      headline,
      description: createCleanExcerpt(rawDescription, 155),
      ctaPrimary: 'Shop Now',
      ctaSecondary: 'Learn More',
      linkPrimary: `/product/${p.id ?? p.product_id ?? p.slug}`,
      linkSecondary: '/about',
      image: p.image || p.image_url || '',
      bgGradient: GRADIENTS[idx % GRADIENTS.length],
      accentColor: ACCENTS[idx % ACCENTS.length],
      price: Number.isFinite(numericPrice) ? numericPrice : null,
      discount_percentage: Number(p?.discount_percentage) || 0,
      rating: Number.isFinite(ratingValue) ? ratingValue : 0,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
      category: categoryLabel,
      isOrganic: isTruthyFlag(p?.is_organic),
      inStock,
    };
  });
};

/**
 * Builds per-slide chips strictly bound to each slide's own product data.
 * Always keeps discount, sale price + original price, and category visible so
 * Hero pricing & category stay 100% synced with Featured Products.
 */
export const buildHeroSlideChips = (slide, settings, { getProductPricing, formatPrice }) => {
  const currency = settings?.currency || 'PKR';
  const chips = [];
  const pricing = getProductPricing(slide, settings);

  if (Number.isFinite(slide?.price) && slide.price > 0) {
    if (pricing.onSale) {
      chips.push({
        key: 'sale',
        label: `${pricing.effectivePct}% OFF`,
        classes: 'border-rose-300 bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold',
        iconName: 'tag',
      });
      chips.push({
        key: 'price',
        label: formatPrice(pricing.salePrice, currency),
        originalLabel: formatPrice(pricing.base, currency),
        classes: 'border-emerald-200 bg-white/90 text-emerald-800',
        iconName: 'tag',
      });
    } else {
      chips.push({
        key: 'price',
        label: formatPrice(pricing.salePrice, currency),
        originalLabel: null,
        classes: 'border-emerald-200 bg-white/90 text-emerald-800',
        iconName: 'tag',
      });
    }
  }

  // Always include category immediately after pricing so it is never dropped
  // when a discounted product also has customer reviews.
  if (slide?.category) {
    chips.push({
      key: 'category',
      label: slide.category,
      classes: 'border-slate-200 bg-white/80 text-slate-700',
      iconName: null,
    });
  }

  if (Number.isFinite(slide?.rating) && slide.rating > 0) {
    const reviewLabel = slide.reviewCount > 0 ? ` (${slide.reviewCount})` : '';
    chips.push({
      key: 'rating',
      label: `${slide.rating.toFixed(1)}${reviewLabel}`,
      classes: 'border-amber-200 bg-amber-50/80 text-amber-800',
      iconName: 'star',
    });
  }

  if (slide?.isOrganic) {
    chips.push({
      key: 'organic',
      label: 'Organic',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      iconName: 'leaf',
    });
  }

  if (slide?.inStock) {
    chips.push({
      key: 'stock',
      label: 'In stock',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      iconName: 'package',
    });
  }

  return chips.slice(0, 4);
};
