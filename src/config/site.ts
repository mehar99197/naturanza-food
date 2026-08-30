/**
 * Single source of truth for the public site identity used in canonicals,
 * Open Graph tags and structured data. Mirrors frontend/src/config/site.js so
 * that a page reads the same values before and after it migrates.
 *
 * PUBLIC_SITE_URL is a server variable, not a NEXT_PUBLIC_ one: every consumer
 * below runs during server rendering, and the value is emitted into the HTML
 * rather than read by browser JavaScript.
 *
 * ⚠ WHEN THIS IS READ DEPENDS ON THE ROUTE. A statically prerendered page bakes
 * SITE_URL into its HTML at BUILD time; a dynamic one reads it per request. So a
 * build run with PUBLIC_SITE_URL pointing somewhere else — a staging host, a
 * local port — ships canonicals and og:url for that host on every static page,
 * and search engines would be told the canonical home of the content is there.
 *
 * The fallback below is the production origin precisely so that a build with the
 * variable unset is still correct. Set it during a build only when the build's
 * output really is meant to be served from that origin.
 */
const RAW_SITE_URL = process.env.PUBLIC_SITE_URL || "https://naturanzafood.com";

/** No trailing slash, so callers can safely write `${SITE_URL}/path`. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

export const SITE_NAME = "Naturanza Food";

export const DEFAULT_TITLE =
  "Naturanza Food - Premium Organic & Natural Products | Buy Online in Pakistan";

export const DEFAULT_DESCRIPTION =
  "Shop premium organic honey, herbal teas, natural supplements, and wellness products. " +
  "100% natural, sustainably sourced. Free shipping on orders over Rs. 5,000 across Pakistan.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-image.jpg`;

export const LOCALE = "en_PK";

export const CURRENCY = "PKR";

/** Absolute URL for a site-relative path. Passes through URLs that are already absolute. */
export const absoluteUrl = (pathOrUrl: string): string => {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return SITE_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

/** Absolute image URL, falling back to the site-wide OG image when unset. */
export const absoluteImage = (value: string | null | undefined): string =>
  value?.trim() ? absoluteUrl(value) : DEFAULT_OG_IMAGE;
