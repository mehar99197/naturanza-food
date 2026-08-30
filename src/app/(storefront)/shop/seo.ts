import type { Metadata } from "next";

import { DEFAULT_OG_IMAGE, LOCALE, SITE_NAME, SITE_URL } from "@/config/site";

/**
 * The shop's page copy for `<title>`, description and keywords, lifted from
 * `ShopSEO` in frontend/src/components/SEO.jsx. The strings are reproduced
 * exactly; only their assembly changed, from a `<Helmet>` in the browser to a
 * Metadata object emitted with the HTML.
 *
 * ⚠ THE TABLE IS KEYED BY SLUG AND IS STALE. Four of its five keys —
 * herbal-teas, supplements, oils, seeds — do not correspond to categories the
 * catalog currently has, and two categories that do exist (herbal-oils,
 * organic-powders) are missing from it. Those URLs therefore fall through to
 * the generic entry. Carried over unchanged rather than re-guessed, because
 * fixing it means deciding what each real category's indexed description should
 * say — a copy decision, not a porting one. See the report.
 */

interface ShopSeoConfig {
  title: string;
  description: string;
  keywords: string;
}

const CATEGORY_SEO: Record<string, ShopSeoConfig> = {
  honey: {
    title: "Organic Honey",
    description:
      "Pure, raw organic honey sourced from Pakistani beekeepers. 100% natural, unprocessed honey for health and wellness.",
    keywords:
      "organic honey Pakistan, raw honey online, pure honey buy, natural honey Karachi Lahore",
  },
  "herbal-teas": {
    title: "Herbal Teas",
    description:
      "Premium herbal and green teas from trusted sources. Caffeine-free options for relaxation and detox.",
    keywords: "herbal tea Pakistan, green tea online, detox tea buy, natural tea store",
  },
  supplements: {
    title: "Natural Supplements",
    description:
      "Boost your health naturally with our curated supplements. Free from artificial additives and preservatives.",
    keywords:
      "natural supplements Pakistan, organic supplements, health supplements online, vitamins Pakistan",
  },
  oils: {
    title: "Natural Oils",
    description:
      "Cold-pressed natural oils for cooking and wellness. Including olive oil, coconut oil, and more.",
    keywords:
      "natural oils Pakistan, cold pressed oil online, organic cooking oil, coconut oil buy Pakistan",
  },
  seeds: {
    title: "Organic Seeds",
    description:
      "Nutrient-rich organic seeds for supercharge your diet. Chia seeds, flaxseeds, pumpkin seeds and more.",
    keywords:
      "organic seeds Pakistan, chia seeds online, flax seeds buy, healthy seeds Pakistan",
  },
};

/** `/shop` itself. */
const ALL_PRODUCTS_SEO: ShopSeoConfig = {
  title: "Shop All Products",
  description:
    "Browse our complete range of organic and natural products. Premium quality, sustainably sourced across Pakistan.",
  keywords: "organic products Pakistan, natural food online, buy organic food",
};

/** A category slug with no entry in the table above. */
const UNKNOWN_CATEGORY_SEO: ShopSeoConfig = {
  title: "Shop",
  description: "Browse our complete range of organic and natural products.",
  keywords: "",
};

export const resolveShopSeo = (categorySlug: string | null): ShopSeoConfig =>
  categorySlug
    ? CATEGORY_SEO[categorySlug] ?? UNKNOWN_CATEGORY_SEO
    : ALL_PRODUCTS_SEO;

/**
 * Keyword list, matching the original's `${kw}, ${category} online Pakistan`.
 *
 * Split into an array because that is Metadata's shape, and blanks are dropped:
 * the string version produced a leading ", " for any category with no keywords
 * of its own, which is an artefact of concatenation rather than a keyword.
 */
const shopKeywords = (config: ShopSeoConfig, categorySlug: string | null): string[] =>
  [...config.keywords.split(",").map((keyword) => keyword.trim()), `${categorySlug || "organic products"} online Pakistan`]
    .filter((keyword) => keyword.length > 0);

export interface ShopMetadataOptions {
  /** The `[category]` slug, or null for `/shop`. */
  categorySlug: string | null;
  /** Canonical path for this page — `/shop` or `/shop/<slug>`. */
  canonicalPath: string;
}

/**
 * Metadata for both shop routes.
 *
 * ONE DELIBERATE CORRECTION. `ShopSEO` set the canonical to
 * `${SITE_URL}/shop/${category}` whenever a category was selected — including
 * when the selection came from `?category=<numeric id>`, which produced a
 * canonical pointing at `/shop/7`, a URL that has never existed. Here `/shop`
 * canonicalises to `/shop` whatever the query string says, and only the real
 * `/shop/<slug>` route canonicalises to itself. See the report.
 */
export const buildShopMetadata = ({
  categorySlug,
  canonicalPath,
}: ShopMetadataOptions): Metadata => {
  const config = resolveShopSeo(categorySlug);
  const fullTitle = `${config.title} | ${SITE_NAME}`;

  return {
    title: config.title,
    description: config.description,
    keywords: shopKeywords(config, categorySlug),
    alternates: { canonical: canonicalPath },
    // openGraph and twitter replace the parent objects wholesale rather than
    // merging field by field, so every field the social card needs is repeated.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${canonicalPath}`,
      title: fullTitle,
      description: config.description,
      images: [{ url: DEFAULT_OG_IMAGE, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: config.description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
};
