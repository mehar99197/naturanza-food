import { SITE_NAME, SITE_URL } from "@/config/site";
import type { JsonLd } from "@/server/seo/jsonLd";
import { LOGO_URL } from "@/server/seo/organization";

/**
 * WebSite structured data, ported from `WebsiteStructuredData` in
 * frontend/src/components/StructuredData.jsx property for property.
 *
 * Home.jsx emitted `OrganizationStructuredData` *and* `WebsiteStructuredData`.
 * Only the WebSite half lives here: the storefront layout already describes the
 * organisation once per document (see @/server/seo/organization), and repeating
 * it on the home page would give one document two Organization nodes.
 *
 * The `SearchAction` is what makes a sitelinks search box possible — it tells
 * Google that /shop?search=… is this site's own search endpoint.
 */
export const buildWebsiteJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  description:
    "Premium Organic & Natural Products in Pakistan - Shop online for organic honey, herbal teas, supplements and more",
  url: SITE_URL,
  inLanguage: "en-PK",
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
    },
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/shop?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
});
