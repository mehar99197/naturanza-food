import { SITE_NAME, SITE_URL } from "@/config/site";
import type { JsonLd } from "@/server/seo/jsonLd";
import {
  LOGO_URL,
  OPEN_ALL_HOURS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "@/server/seo/organization";

/**
 * The LocalBusiness block, a port of `LocalBusinessStructuredData` in
 * `frontend/src/components/StructuredData.jsx`.
 *
 * Only this page publishes it — it is the page about reaching the business.
 * Organization moved to @/server/seo/organization and is emitted once per
 * document by the storefront layout, so this page no longer repeats it.
 */
export const buildLocalBusinessJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: SITE_NAME,
  description:
    "Online organic food store delivering premium natural products across Pakistan",
  url: SITE_URL,
  image: LOGO_URL,
  telephone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  address: {
    "@type": "PostalAddress",
    addressCountry: "PK",
  },
  geo: {
    "@type": "Geo",
    addressCountry: "Pakistan",
  },
  openingHoursSpecification: OPEN_ALL_HOURS,
  sameAs: [
    "https://www.facebook.com/naturanzafood",
    "https://www.instagram.com/naturanzafood",
  ],
});
