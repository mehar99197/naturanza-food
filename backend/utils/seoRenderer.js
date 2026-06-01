/**
 * Server-side SEO meta renderer.
 *
 * The frontend is a client-rendered SPA: its built index.html ships with generic
 * (homepage) meta tags, and react-helmet only sets per-page tags AFTER JavaScript
 * runs. That breaks two things for SEO:
 *   1) Social/link scrapers (WhatsApp, Facebook, Twitter) don't run JS, so a shared
 *      product link previews the generic homepage title/image instead of the product.
 *   2) Unknown URLs return HTTP 200 with the shell (soft-404), which Google penalises.
 *
 * This module reads the built index.html template once and, for each navigation
 * request, rewrites the <title>/description/OG/Twitter/canonical tags (and injects
 * Product JSON-LD) based on the route — querying the DB for product/category pages.
 * It also returns the correct HTTP status (404 for missing products/categories and
 * genuinely unknown paths) so search engines stop seeing soft-404s.
 *
 * It is intentionally fail-safe: callers fall back to serving the raw index.html if
 * anything here throws, so meta rendering can never break navigation.
 */
const fs = require("fs");
const path = require("path");
const { dbPool } = require("../config/db");

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://naturanzafood.com").replace(/\/+$/, "");
const SITE_NAME = "Naturanza Food";
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-image.jpg`;
const DEFAULT_TITLE = "Naturanza Food - Premium Organic & Natural Products | Buy Online in Pakistan";
const DEFAULT_DESCRIPTION =
  "Shop premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural, sustainably sourced. Free shipping on orders over Rs. 5,000 across Pakistan.";

let cachedTemplate = null;

const loadTemplate = (distDir) => {
  if (cachedTemplate) return cachedTemplate;
  cachedTemplate = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  return cachedTemplate;
};

const escapeAttr = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const truncate = (text, max = 160) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

const absoluteImage = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_OG_IMAGE;
  if (raw.startsWith("http")) return raw;
  return `${SITE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

const setTitle = (html, title) =>
  html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);

const setMeta = (html, attr, key, content) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(content)}$2`);
};

const setCanonical = (html, url) =>
  html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${escapeAttr(url)}$2`);

const applyMeta = (template, meta) => {
  let html = template;
  const ogTitle = meta.ogTitle || meta.title;
  const image = meta.image || DEFAULT_OG_IMAGE;

  html = setTitle(html, meta.title);
  html = setMeta(html, "name", "title", meta.title);
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:type", meta.ogType || "website");
  html = setMeta(html, "property", "og:url", meta.url);
  html = setMeta(html, "property", "og:title", ogTitle);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "property", "twitter:url", meta.url);
  html = setMeta(html, "property", "twitter:title", ogTitle);
  html = setMeta(html, "property", "twitter:description", meta.description);
  html = setMeta(html, "property", "twitter:image", image);
  html = setCanonical(html, meta.url);

  if (meta.robots) {
    html = setMeta(html, "name", "robots", meta.robots);
    html = setMeta(html, "name", "googlebot", meta.robots);
  }

  if (meta.jsonLd) {
    const block = `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
    html = html.replace("</head>", `    ${block}\n  </head>`);
  }

  return html;
};

// Static, indexable pages — titles mirror the client-side react-helmet titles.
const STATIC_PAGES = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/shop": {
    title: `Shop All Products | ${SITE_NAME}`,
    description:
      "Browse our complete range of organic and natural products. Premium quality, sustainably sourced across Pakistan.",
  },
  "/about": {
    title: `About Us | ${SITE_NAME}`,
    description:
      "Naturanza Food — Pakistan's trusted source for premium organic honey, herbal teas, supplements, and natural wellness products.",
  },
  "/contact": {
    title: `Contact Us | ${SITE_NAME}`,
    description: "Get in touch with Naturanza Food for orders, products, and support across Pakistan.",
  },
  "/faq": {
    title: `Frequently Asked Questions | ${SITE_NAME}`,
    description: "Answers to common questions about ordering, shipping, payments, and returns at Naturanza Food.",
  },
  "/shipping": {
    title: `Shipping and Delivery | ${SITE_NAME}`,
    description: "Shipping information, delivery windows, and charges for orders across Pakistan.",
  },
  "/returns": {
    title: `Returns and Refunds Policy | ${SITE_NAME}`,
    description: "Our returns and refunds policy — a 3-day window for shipping-related issues.",
  },
  "/terms": {
    title: `Terms of Service | ${SITE_NAME}`,
    description: "Terms of service for using Naturanza Food's website and services.",
  },
  "/privacy": {
    title: `Privacy Policy | ${SITE_NAME}`,
    description: "How Naturanza Food collects, uses, and protects your personal information.",
  },
  "/cookies": {
    title: `Cookie Policy | ${SITE_NAME}`,
    description: "How Naturanza Food uses cookies and local storage to improve your experience.",
  },
  "/blog": {
    title: `Blog | ${SITE_NAME}`,
    description: "Wellness tips, recipes, and insights on organic living from Naturanza Food.",
  },
};

// Valid app routes that should NOT be indexed (private/auth/checkout/account/admin).
// Served with 200 + noindex so they render normally but stay out of search.
const NOINDEX_PREFIXES = [
  "/login",
  "/register",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/checkout",
  "/cart",
  "/profile",
  "/account",
  "/orders",
  "/wishlist",
  "/reviews",
  "/security",
  "/settings",
  "/notifications",
  "/admin",
];

const notFoundMeta = (url) => ({
  title: `Page Not Found | ${SITE_NAME}`,
  description: "The page you are looking for could not be found.",
  url,
  robots: "noindex, nofollow",
});

const fetchProduct = async (param) => {
  const isNumeric = /^\d+$/.test(param);
  const [rows] = await dbPool.query(
    `SELECT p.id, p.name, p.slug, p.description, p.price, p.image_url, p.stock_quantity, p.is_active,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${isNumeric ? "p.id = ?" : "p.slug = ?"}
     LIMIT 1`,
    [param],
  );
  const product = rows[0];
  if (!product || product.is_active === 0) return null;
  return product;
};

const fetchCategory = async (slug) => {
  const [rows] = await dbPool.query(
    "SELECT id, name, slug, description, image_url, is_active FROM categories WHERE slug = ? LIMIT 1",
    [slug],
  );
  const category = rows[0];
  if (!category || category.is_active === 0) return null;
  return category;
};

const buildProductMeta = (product) => {
  const url = `${SITE_URL}/product/${product.id}`;
  const image = absoluteImage(product.image_url);
  const description =
    truncate(product.description) ||
    `${product.name} — premium organic product from Naturanza Food. Order online with Cash on Delivery across Pakistan.`;
  const price = Number(product.price);

  const offers = {
    "@type": "Offer",
    url,
    priceCurrency: "PKR",
    availability:
      Number(product.stock_quantity) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  if (Number.isFinite(price)) {
    offers.price = price.toFixed(2);
  }

  return {
    title: `${product.name} | ${SITE_NAME}`,
    description,
    url,
    image,
    ogType: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: [image],
      description,
      category: product.category_name || undefined,
      brand: { "@type": "Brand", name: SITE_NAME },
      offers,
    },
  };
};

// Resolve { status, meta } for a request path.
const resolveMeta = async (reqPath) => {
  const pathname = (reqPath || "/").split("?")[0].replace(/\/+$/, "") || "/";

  const staticPage = STATIC_PAGES[pathname];
  if (staticPage) {
    return {
      status: 200,
      meta: { ...staticPage, url: `${SITE_URL}${pathname === "/" ? "/" : pathname}` },
    };
  }

  if (NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return {
      status: 200,
      meta: {
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        url: `${SITE_URL}${pathname}`,
        robots: "noindex, nofollow",
      },
    };
  }

  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const product = await fetchProduct(decodeURIComponent(productMatch[1]));
    if (!product) {
      return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`) };
    }
    return { status: 200, meta: buildProductMeta(product) };
  }

  const categoryMatch = pathname.match(/^\/shop\/([^/]+)$/);
  if (categoryMatch) {
    const category = await fetchCategory(decodeURIComponent(categoryMatch[1]));
    if (!category) {
      return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`) };
    }
    return {
      status: 200,
      meta: {
        title: `${category.name} | ${SITE_NAME}`,
        description: truncate(category.description) || `Shop ${category.name} at Naturanza Food.`,
        url: `${SITE_URL}${pathname}`,
        image: category.image_url ? absoluteImage(category.image_url) : DEFAULT_OG_IMAGE,
      },
    };
  }

  // Blog posts are low-risk; treat as known (indexable) until a real blog model exists.
  if (/^\/blog\/[^/]+$/.test(pathname)) {
    return {
      status: 200,
      meta: { ...STATIC_PAGES["/blog"], url: `${SITE_URL}${pathname}` },
    };
  }

  // Anything else is a genuine 404 — return the correct status (no more soft-404s).
  return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`) };
};

const renderPage = async (reqPath, distDir) => {
  const template = loadTemplate(distDir);
  const { status, meta } = await resolveMeta(reqPath);
  return { status, html: applyMeta(template, meta) };
};

module.exports = { renderPage };
