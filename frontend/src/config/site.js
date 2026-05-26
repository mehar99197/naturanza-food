// Single source of truth for the public site URL used in SEO tags,
// structured data, social previews, blog canonical links, etc.
// Override per-environment via the Vite env var VITE_SITE_URL.
const RAW = import.meta.env?.VITE_SITE_URL || "https://naturanzafood.com";

// Strip trailing slash so callers can confidently do `${SITE_URL}/path`.
export const SITE_URL = RAW.replace(/\/+$/, "");

// Convenience accessor for places that want just the domain (e.g.,
// Twitter "domain" meta tag).
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");
