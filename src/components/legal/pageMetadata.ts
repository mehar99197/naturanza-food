import type { Metadata } from "next";

import { DEFAULT_OG_IMAGE, LOCALE, SITE_NAME, SITE_URL } from "@/config/site";

/**
 * The metadata block these six pages all need, in one place.
 *
 * Every value mirrors what the matching helper in
 * `frontend/src/components/SEO.jsx` emitted — `FAQSEO`, `ShippingSEO`,
 * `ReturnsSEO`, `TermsSEO`, `PrivacySEO`, `CookiesSEO`. Two things are fixed in
 * passing, both consequences of the SPA reading `window.location`:
 *
 *  - the canonical is the page's own path rather than whatever URL the visitor
 *    arrived on, so tracking query strings no longer canonicalise to themselves;
 *  - it is emitted server-side, so a crawler sees it without running JavaScript.
 *
 * `openGraph` and `twitter` replace the root layout's objects wholesale instead
 * of merging field by field, so every field the social card needs is repeated
 * here — the image above all, which would otherwise be dropped.
 */
export interface LegalPageMeta {
  /** Bare title; the root layout's template appends " | Naturanza Food". */
  title: string;
  description: string;
  keywords: string[];
  /** Site-relative canonical path, e.g. "/faq". */
  path: string;
}

export const buildLegalMetadata = ({
  title,
  description,
  keywords,
  path,
}: LegalPageMeta): Metadata => {
  const fullTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${path}`,
      title: fullTitle,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
};
