import { CURRENCY, SITE_NAME, SITE_URL } from "@/config/site";
import type { JsonLd } from "@/server/seo/jsonLd";

import type { FaqEntry } from "./types";

/**
 * Structured data for the support pages, ported from
 * `frontend/src/components/StructuredData.jsx` (and, for the FAQ block, from the
 * copy of `FAQStructuredData` that `FAQ.jsx` inlined).
 *
 * Only schema the SPA already published appears here — FAQPage on /faq,
 * ShippingPolicy on /shipping, MerchantReturnPolicy on /returns. Terms, privacy
 * and cookies published none and still publish none.
 *
 * WHERE THE SHIPPING NUMBERS COME FROM. `ShippingPolicyStructuredData` read
 * `currency`, `shippingFlat` and `shippingFree` from SettingsContext and ran the
 * two amounts through the visitor's auto-detected display currency. That is a
 * client store with no server equivalent, so — following the same call made in
 * `@/server/seo/organization` — these read the constants `DEFAULT_SETTINGS`
 * seeds that store with, and the currency is the site constant. The emitted
 * markup is therefore identical to what a visitor saw on a default install.
 *
 * Two consequences, both improvements:
 *  - the amounts no longer change per visitor. Structured data describes the
 *    merchant's policy, and quoting a threshold in a currency the store does not
 *    price in was a quirk of reading a per-visitor store, not intent.
 *  - an admin who edits the shipping figures in settings will not see them
 *    change here. See the note returned with this batch: a server-side settings
 *    reader would close that gap for this page and for the layout's Organization
 *    block at the same time.
 */

/** Flat shipping rate in PKR — `DEFAULT_SETTINGS.shippingFlat`. */
const SHIPPING_FLAT_RATE = 250;

/** Free-shipping threshold in PKR — `DEFAULT_SETTINGS.shippingFree`. */
const FREE_SHIPPING_THRESHOLD = 5000;

export const buildFaqPageJsonLd = (faqs: readonly FaqEntry[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

export const buildShippingPolicyJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ShippingPolicy",
  name: `Shipping and Delivery Information - ${SITE_NAME}`,
  url: `${SITE_URL}/shipping`,
  shippingDetails: {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: String(SHIPPING_FLAT_RATE),
      currency: CURRENCY,
    },
    freeShippingThreshold: {
      "@type": "MonetaryAmount",
      value: String(FREE_SHIPPING_THRESHOLD),
      currency: CURRENCY,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "PK",
    },
    // PRESERVED AS FOUND, malformation included. Schema.org expects
    // `transitTime` to be a QuantitativeValue sitting beside `handlingTime`;
    // the source nests a second ShippingDeliveryTimeSpecification inside it and
    // puts the 2-5 day transit under that child's `handlingTime`, so the real
    // transit window is not readable by a parser. Fixing the nesting would
    // change what Google is told about this merchant, which is a business
    // decision — it is reported with this batch instead.
    deliveryTime: {
      "@type": "ShippingDeliveryTimeSpecification",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "ShippingDeliveryTimeSpecification",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 2,
          maxValue: 5,
          unitCode: "BUSINESS_DAY",
        },
      },
    },
  },
  // PRESERVED AS FOUND: 7 days, free returns by mail. Both /returns and /faq
  // tell a reader the window is 3 days, returns are accepted only for
  // shipping damage, and change-of-mind returns are refused. Reported.
  hasMerchantReturnPolicy: {
    "@type": "MerchantReturnPolicy",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  },
});

export const buildReturnPolicyJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "MerchantReturnPolicy",
  name: `Returns and Refunds Policy - ${SITE_NAME}`,
  url: `${SITE_URL}/returns`,
  // PRESERVED AS FOUND — same 7-day/free-return mismatch with the visible copy
  // as the block above. Reported rather than silently corrected.
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 7,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
  description:
    "Items must be unused, sealed, and in original packaging. Refunds processed within 5-10 business days after quality check.",
  applicableCountry: "PK",
});
