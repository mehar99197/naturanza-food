import { normalizePhoneLink } from "@/components/contact/contactDetails";
import { BUSINESS_INFO } from "@/config/legal";
import { CURRENCY, SITE_NAME, SITE_URL } from "@/config/site";

import type { JsonLd } from "./jsonLd";

/**
 * Who the business is. Emitted once per page from the storefront layout.
 *
 * A port of `OrganizationStructuredData` in
 * `frontend/src/components/StructuredData.jsx`, property for property. The SPA
 * rendered it on several pages; describing the same organisation once per
 * document is what Google expects, so the layout owns it and no page repeats it.
 *
 * WHERE THE CONTACT DETAILS COME FROM: the SPA read them from SettingsContext,
 * falling back to `BUSINESS_INFO` whenever a field was blank. This runs on the
 * server, where there is no SettingsProvider, so it reads `BUSINESS_INFO`
 * directly — the same constants `DEFAULT_SETTINGS` seeds the client store with,
 * so the markup is identical unless an admin has overridden email or phone in
 * the settings table. Emitting from the server puts it in the initial HTML
 * rather than behind hydration.
 *
 * Currency is the site constant, not the visitor's auto-detected display
 * currency: structured data describes the business, and the SPA's per-visitor
 * `priceRange` was a quirk of reading a client store rather than intent.
 */

export const OPEN_ALL_HOURS = {
  "@type": "OpeningHoursSpecification",
  dayOfWeek: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  opens: "00:00",
  closes: "23:59",
} as const;

export const LOGO_URL = `${SITE_URL}/images/logo.png`;
export const SUPPORT_EMAIL = BUSINESS_INFO.contacts.supportEmail;
export const SUPPORT_PHONE = normalizePhoneLink(BUSINESS_INFO.contacts.phone);
/** wa.me wants the number without the leading `+`. */
export const WHATSAPP_NUMBER = SUPPORT_PHONE.replace(/^\+/, "") || "923409502646";

export const buildOrganizationJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  description:
    "Pakistan's trusted online store for premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural and sustainably sourced.",
  url: SITE_URL,
  logo: LOGO_URL,
  image: LOGO_URL,
  telephone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  address: {
    "@type": "PostalAddress",
    addressCountry: "PK",
    addressRegion: "Pakistan",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: SUPPORT_PHONE,
    contactType: "Customer Service",
    areaServed: "PK",
    availableLanguage: ["English", "Urdu"],
    hoursAvailable: OPEN_ALL_HOURS,
  },
  sameAs: [
    "https://www.facebook.com/naturanzafood",
    "https://www.instagram.com/naturanzafood",
    "https://www.twitter.com/naturanzafood",
    `https://wa.me/${WHATSAPP_NUMBER}`,
  ],
  areaServed: {
    "@type": "Country",
    name: "Pakistan",
  },
  priceRange: CURRENCY,
  currenciesAccepted: CURRENCY,
  paymentAccepted: "Cash on Delivery, Credit Card, Bank Transfer",
});
