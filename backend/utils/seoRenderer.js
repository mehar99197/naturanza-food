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
const { getAdminSettings } = require("./adminSettings");
const { getProductContentDefaults } = require("./productContentDefaults");

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://naturanzafood.com").replace(/\/+$/, "");
const SITE_NAME = "Naturanza Food";
const LEGAL_NAME = "Naturanza Foods";
const BUSINESS_ADDRESS = "Nizam Pura, Chunian, District Kasur, Punjab, Pakistan";
const SUPPORT_EMAIL = "support@naturanzafood.com";
const SUPPORT_PHONE = "+92340 9502646";
const DEFAULT_CURRENCY = "PKR";
const DEFAULT_SHIPPING_FREE = 5000;
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-image.jpg`;
const DEFAULT_TITLE = "Naturanza Food - Premium Organic & Natural Products | Buy Online in Pakistan";
const DEFAULT_DESCRIPTION =
  "Shop pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural, sustainably sourced. Free shipping on prepaid online orders over Rs. 5,000 across Pakistan.";
const DEFAULT_SHIPPING_DESCRIPTION =
  "Shipping policy for Naturanza Food (Naturanza Foods): 3–5 working days delivery across Pakistan and free shipping on prepaid online orders over Rs. 5,000.";

const SETTINGS_CACHE_TTL_MS = 60 * 1000;
let cachedSeoSettings = null;
let cachedSeoSettingsAt = 0;

const DEFAULT_SEO_SETTINGS = {
  storeName: SITE_NAME,
  storeEmail: SUPPORT_EMAIL,
  storePhone: SUPPORT_PHONE,
  address: BUSINESS_ADDRESS,
  shippingFree: DEFAULT_SHIPPING_FREE,
  currency: DEFAULT_CURRENCY,
  storeDiscountPct: 0,
};

const clampDiscountPercent = (value) => Math.min(Math.max(Number(value) || 0, 0), 90);

const resolveSeoSettings = (overrides = null) => {
  if (!overrides || typeof overrides !== "object") {
    return DEFAULT_SEO_SETTINGS;
  }

  const storeName = String(overrides.storeName || "").trim() || SITE_NAME;
  const storeEmail = String(overrides.storeEmail || "").trim() || SUPPORT_EMAIL;
  const storePhone = String(overrides.storePhone || "").trim() || SUPPORT_PHONE;
  const address = String(overrides.address || "").trim() || BUSINESS_ADDRESS;
  const parsedShippingFree = Number(overrides.shippingFree);
  const shippingFree =
    Number.isFinite(parsedShippingFree) && parsedShippingFree >= 0
      ? parsedShippingFree
      : DEFAULT_SHIPPING_FREE;
  const currency =
    String(overrides.currency || "").trim().toUpperCase() || DEFAULT_CURRENCY;
  const storeDiscountPct =
    overrides.storeDiscountActive && Number(overrides.storeDiscountPercentage) > 0
      ? clampDiscountPercent(overrides.storeDiscountPercentage)
      : clampDiscountPercent(overrides.storeDiscountPct);

  return {
    storeName,
    storeEmail,
    storePhone,
    address,
    shippingFree,
    currency,
    storeDiscountPct,
  };
};

const fetchSeoSettings = async () => {
  const now = Date.now();
  if (cachedSeoSettings && now - cachedSeoSettingsAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSeoSettings;
  }
  try {
    const live = await getAdminSettings(dbPool);
    cachedSeoSettings = resolveSeoSettings(live);
    cachedSeoSettingsAt = now;
    return cachedSeoSettings;
  } catch {
    return cachedSeoSettings || DEFAULT_SEO_SETTINGS;
  }
};

const formatShippingThreshold = (amount, currency = DEFAULT_CURRENCY) => {
  const rounded = Math.round(Number(amount) || 0).toLocaleString("en-US");
  return currency === "PKR" ? `Rs. ${rounded}` : `${currency} ${rounded}`;
};

const computeEffectiveProductPrice = (product, storeDiscountPct = 0) => {
  const base = Number(product?.price);
  if (!Number.isFinite(base)) return Number.NaN;
  const perProductPct = clampDiscountPercent(product?.discount_percentage);
  const storePct = clampDiscountPercent(storeDiscountPct);
  const effectivePct = Math.max(perProductPct, storePct);
  return effectivePct > 0 ? base - (base * effectivePct) / 100 : base;
};

// Keyed on the built file's mtime: a deploy that replaces index.html without
// restarting Node would otherwise keep serving the previous shell forever, and
// its asset hashes no longer exist — a blank page for every visitor.
let cachedTemplate = null;
let cachedTemplateMtimeMs = 0;

const loadTemplate = (distDir) => {
  const resolved = path.resolve(distDir);
  if (!resolved.startsWith(path.resolve(__dirname, "..", "..", "frontend"))) {
    throw new Error("distDir must be within the frontend directory");
  }

  const templatePath = path.join(resolved, "index.html");
  const { mtimeMs } = fs.statSync(templatePath);
  if (cachedTemplate && mtimeMs === cachedTemplateMtimeMs) {
    return cachedTemplate;
  }

  cachedTemplate = fs.readFileSync(templatePath, "utf8");
  cachedTemplateMtimeMs = mtimeMs;
  return cachedTemplate;
};

const escapeAttr = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// JSON.stringify leaves `<` and `/` alone, so a product name containing
// "</script>" would close the JSON-LD block and everything after it would be
// parsed as markup — stored XSS on the product page, sourced from a DB field.
// The escapes below are inert inside JSON string literals (a JSON parser reads
// < as "<") while being impossible for the HTML parser to mistake for a
// tag. U+2028/U+2029 are legal in JSON but break JavaScript string literals.
const serializeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

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

// Every replacement below goes through a callback rather than a replacement
// string. In a replacement STRING, "$" is a capture reference: a product named
// "Honey $2 Off" injected group 2 (a bare quote) and broke out of the content
// attribute, and "$'" spliced the whole rest of the document in unescaped.
// escapeAttr cannot help — the substitution happens after it runs. Callbacks
// never interpret "$", so the escaped text is inserted verbatim.
const setTitle = (html, title) =>
  html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeAttr(title)}</title>`);

const setMeta = (html, attr, key, content) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, (match, open, close) => `${open}${escapeAttr(content)}${close}`);
};

const setCanonical = (html, url) =>
  html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    (match, open, close) => `${open}${escapeAttr(url)}${close}`,
  );

// The template ships two hreflang links (en-pk + x-default) both pointing at the
// homepage. Left alone they told Google that the canonical alternate for EVERY
// product page was "/" — a direct contradiction of the self-referencing canonical
// two lines above. The /g flag rewrites both to the current URL.
const setHreflang = (html, url) =>
  html.replace(
    /(<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href=")[^"]*(")/g,
    (match, open, close) => `${open}${escapeAttr(url)}${close}`,
  );

// Server-rendered body content for clients that do not run JavaScript.
//
// This was briefly injected as a plain <div> inside #root. React (createRoot)
// does clear the container, but only once the ~185KB bundle has downloaded and
// executed — so every visitor saw a flash of unstyled product text first. That
// is a real regression for humans and the SEO gain does not justify it.
//
// <noscript> is the correct mechanism: a JS-enabled browser never renders it at
// all, so the flash is structurally impossible, while the markup still sits in
// the raw HTML for a crawler's first pass and for genuinely JS-less clients.
// It is also not hidden text — nothing is being shown to crawlers and withheld
// from users; the same facts render visibly once the app mounts.
const renderBodyFallback = (inner) =>
  `<noscript><div id="ssr-content">${inner}</div></noscript>`;

const productBodyHtml = (
  product,
  meta,
  effectivePrice = Number(product.price),
  settings = null,
) => {
  const s = resolveSeoSettings(settings);
  const name = escapeAttr(product.name);
  const price = Number(effectivePrice);
  const availableStock =
    Number(product.stock_quantity || 0) - Number(product.reserved_stock || 0);
  const inStock = availableStock > 0;
  const category = product.category_name
    ? `<li><a href="/shop/${escapeAttr(product.category_slug || "")}">${escapeAttr(product.category_name)}</a></li>`
    : "";

  return renderBodyFallback(
    `<nav aria-label="Breadcrumb"><ol>` +
      `<li><a href="/">Home</a></li>` +
      `<li><a href="/shop">Shop</a></li>` +
      category +
      `<li>${name}</li>` +
      `</ol></nav>` +
      `<h1>${name}</h1>` +
      `<img src="${escapeAttr(meta.image)}" alt="${name} — ${escapeAttr(s.storeName)}" />` +
      `<p>${escapeAttr(meta.description)}</p>` +
      `<p><strong>Price:</strong> <span>${escapeAttr(s.currency)}</span> ` +
      `<span>${Number.isFinite(price) ? price.toFixed(2) : ""}</span></p>` +
      `<p><strong>Availability:</strong> ${inStock ? "In stock" : "Out of stock"}</p>` +
      `<p><strong>Brand:</strong> ${escapeAttr(s.storeName)}</p>` +
      (product.barcode ? `<p><strong>Product code:</strong> ${escapeAttr(product.barcode)}</p>` : "") +
      `<p><a href="/shop">Browse all products</a></p>`,
  );
};

// Static compliance fallback content inside <noscript> so non-JS compliance
// crawlers verifying merchant onboarding receive full policy text on first fetch.
const buildComplianceBodyFallbacks = (settings = null) => {
  const s = resolveSeoSettings(settings);
  const freeShippingText = formatShippingThreshold(s.shippingFree, s.currency);
  const prepaidFreeSentence =
    s.shippingFree > 0
      ? `Prepaid online orders (via SafePay) of ${escapeAttr(freeShippingText)} or more qualify for Free Shipping anywhere in Pakistan. `
      : "";
  const termsFreeClause =
    s.shippingFree > 0
      ? ` (free shipping on prepaid SafePay orders of ${escapeAttr(freeShippingText)} or more)`
      : "";

  return {
    "/shipping": renderBodyFallback(
      `<h1>Shipping &amp; Delivery Policy</h1>` +
        `<p>${escapeAttr(s.storeName)} (Legal Name: ${escapeAttr(LEGAL_NAME)}) processes orders within 24 hours on business days and delivers within 3–5 working days across Pakistan.</p>` +
        `<p>${prepaidFreeSentence}Cash on Delivery (COD) orders carry standard city-specific courier charges shown at checkout.</p>` +
        `<p>Address: ${escapeAttr(s.address)} | Email: ${escapeAttr(s.storeEmail)} | Phone: ${escapeAttr(s.storePhone)}</p>`,
    ),
    "/returns": renderBodyFallback(
      `<h1>Returns &amp; Refund Policy</h1>` +
        `<p>${escapeAttr(s.storeName)} (Legal Name: ${escapeAttr(LEGAL_NAME)}) accepts returns and replacements within 7 days of delivery for damaged, defective, leaked, expired, or incorrect items in their original sealed packaging.</p>` +
        `<p>Quality inspection is completed within 2 business days, and approved refunds are processed within 5–7 business days to the original payment method.</p>` +
        `<p>Address: ${escapeAttr(s.address)} | Email: ${escapeAttr(s.storeEmail)} | Phone: ${escapeAttr(s.storePhone)}</p>`,
    ),
    "/privacy": renderBodyFallback(
      `<h1>Privacy Policy</h1>` +
        `<p>This Privacy Policy describes how ${escapeAttr(s.storeName)} (Legal Name: ${escapeAttr(LEGAL_NAME)}), registered at ${escapeAttr(s.address)}, collects, uses, and protects your personal information.</p>` +
        `<p>Online payments are processed securely via SafePay; card details are never stored on our servers.</p>` +
        `<p>Contact: ${escapeAttr(s.storeEmail)} | Phone: ${escapeAttr(s.storePhone)}</p>`,
    ),
    "/terms": renderBodyFallback(
      `<h1>Terms of Service</h1>` +
        `<p>This online store operates under ${escapeAttr(s.storeName)} (Legal Name: ${escapeAttr(LEGAL_NAME)}), registered at ${escapeAttr(s.address)}.</p>` +
        `<p>Orders are delivered within 3–5 working days across Pakistan${termsFreeClause}. Returns are accepted within 7 days for damaged, defective, or incorrect items, with approved refunds processed within 5–7 business days.</p>` +
        `<p>Contact: ${escapeAttr(s.storeEmail)} | Phone: ${escapeAttr(s.storePhone)}</p>`,
    ),
    "/contact": renderBodyFallback(
      `<h1>Contact Us</h1>` +
        `<p>${escapeAttr(s.storeName)} (Legal Name: ${escapeAttr(LEGAL_NAME)})</p>` +
        `<p>Address: ${escapeAttr(s.address)}</p>` +
        `<p>Email: ${escapeAttr(s.storeEmail)} | Phone: ${escapeAttr(s.storePhone)}</p>`,
    ),
  };
};

// A crawlable link graph for the two pages Google reaches first. Without this the
// sitemap was the ONLY path to a product page — there was not a single
// <a href="/product/N"> anywhere in the pre-JavaScript HTML of the whole site.
const linkListBodyHtml = (heading, products) =>
  renderBodyFallback(
    `<h1>${escapeAttr(heading)}</h1>` +
      `<ul>` +
      products
        .map(
          (product) =>
            `<li><a href="/product/${product.id}">${escapeAttr(product.name)}</a></li>`,
        )
        .join("") +
      `</ul>`,
  );

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
  // Template default is the generic site tagline; a product page must describe
  // its own image or the alt text is simply wrong.
  html = setMeta(html, "property", "og:image:alt", meta.imageAlt || ogTitle);
  html = setMeta(html, "property", "twitter:image:alt", meta.imageAlt || ogTitle);
  html = setCanonical(html, meta.url);
  html = setHreflang(html, meta.url);

  // Placed BEFORE #root, not inside it: React never needs to clear it, and a
  // no-JS client sees the fallback above an empty root rather than nothing.
  if (meta.bodyHtml) {
    html = html.replace(
      '<div id="root"></div>',
      () => `${meta.bodyHtml}<div id="root"></div>`,
    );
  }

  if (meta.robots) {
    html = setMeta(html, "name", "robots", meta.robots);
    html = setMeta(html, "name", "googlebot", meta.robots);
  }

  if (meta.jsonLd) {
    // Callback form again: serializeJsonLd escapes markup characters but leaves
    // "$" alone, and a "$&" in a product name would otherwise be substituted.
    const block = `<script type="application/ld+json">${serializeJsonLd(meta.jsonLd)}</script>`;
    html = html.replace("</head>", () => `    ${block}\n  </head>`);
  }

  return html;
};

const CATEGORY_DESCRIPTION_DEFAULTS = {
  honey: "Pure, raw, and naturally infused honey harvested from trusted mountain farms.",
  ispaghol: "Natural psyllium husk fiber supporting everyday digestion and gut health.",
  spices: "100% pure, chemical-free organic spices freshly ground for authentic taste.",
};

// Static, indexable pages — titles mirror the client-side react-helmet titles.
const buildStaticPages = (settings = null) => {
  const s = resolveSeoSettings(settings);
  const shippingFreeText = formatShippingThreshold(s.shippingFree, s.currency);
  const isDefaultShippingCopy =
    s.storeName === SITE_NAME &&
    s.shippingFree === DEFAULT_SHIPPING_FREE &&
    s.currency === DEFAULT_CURRENCY;

  const homeDescription = isDefaultShippingCopy
    ? DEFAULT_DESCRIPTION
    : s.shippingFree > 0
      ? `Shop pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural, sustainably sourced. Free shipping on prepaid online orders over ${shippingFreeText} across Pakistan.`
      : "Shop pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural, sustainably sourced across Pakistan.";

  const shippingDescription = isDefaultShippingCopy
    ? DEFAULT_SHIPPING_DESCRIPTION
    : s.shippingFree > 0
      ? `Shipping policy for ${s.storeName} (${LEGAL_NAME}): 3–5 working days delivery across Pakistan and free shipping on prepaid online orders over ${shippingFreeText}.`
      : `Shipping policy for ${s.storeName} (${LEGAL_NAME}): 3–5 working days delivery across Pakistan.`;

  return {
    "/": {
      title:
        s.storeName === SITE_NAME
          ? DEFAULT_TITLE
          : `${s.storeName} - Premium Organic & Natural Products | Buy Online in Pakistan`,
      description: homeDescription,
    },
    "/shop": {
      title: `Shop All Products | ${s.storeName}`,
      description:
        "Browse our complete range of organic and natural products. Premium quality, sustainably sourced across Pakistan.",
    },
    "/about": {
      title: `About Us | ${s.storeName}`,
      description: `${s.storeName} — Pakistan's trusted source for pure organic honey, ispaghol husk, organic spices, and natural wellness products.`,
    },
    "/contact": {
      title: `Contact Us | ${s.storeName}`,
      description: `Contact ${s.storeName} (${LEGAL_NAME}) at ${s.address}. Email ${s.storeEmail} or call ${s.storePhone}.`,
    },
    "/faq": {
      title: `Frequently Asked Questions | ${s.storeName}`,
      description: `Answers to common questions about ordering, shipping, payments, and returns at ${s.storeName}.`,
    },
    "/shipping": {
      title: `Shipping and Delivery | ${s.storeName}`,
      description: shippingDescription,
    },
    "/returns": {
      title: `Returns and Refunds Policy | ${s.storeName}`,
      description: `Returns and refunds policy for ${s.storeName} (${LEGAL_NAME}): 7-day return window for damaged, defective, or incorrect items and refunds processed within 5–7 business days.`,
    },
    "/terms": {
      title: `Terms of Service | ${s.storeName}`,
      description: `Terms of service for using ${s.storeName} (Legal Name: ${LEGAL_NAME}) website and services.`,
    },
    "/privacy": {
      title: `Privacy Policy | ${s.storeName}`,
      description: `How ${s.storeName} (Legal Name: ${LEGAL_NAME}) collects, uses, and protects your personal information.`,
    },
    "/cookies": {
      title: `Cookie Policy | ${s.storeName}`,
      description: `How ${s.storeName} uses cookies and local storage to improve your experience.`,
    },
    "/blog": {
      title: `Blog | ${s.storeName}`,
      description: `Wellness tips, recipes, and insights on organic living from ${s.storeName}.`,
    },
  };
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

const notFoundMeta = (url, settings = null) => {
  const s = resolveSeoSettings(settings);
  return {
    title: `Page Not Found | ${s.storeName}`,
    description: "The page you are looking for could not be found.",
    url,
    robots: "noindex, nofollow",
  };
};

const safeDecodeParam = (raw) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
};

const fetchProduct = async (param) => {
  if (!param) return null;
  const isNumeric = /^\d+$/.test(param);
  const [rows] = await dbPool.query(
    `SELECT p.id, p.name, p.slug, p.description, p.price, p.discount_percentage, p.image_url, p.stock_quantity, p.reserved_stock, p.is_active, p.barcode,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${isNumeric ? "p.id = ?" : "p.slug = ?"} AND p.deleted_at IS NULL
     LIMIT 1`,
    [param],
  );
  const product = rows[0];
  if (!product || product.is_active === 0) return null;
  return product;
};

const fetchActiveStoreDiscountPct = async () => {
  try {
    const [rows] = await dbPool.query(
      "SELECT store_discount_active, store_discount_percentage FROM admin_settings WHERE id = 1 LIMIT 1",
    );
    const row = rows[0];
    const isActive =
      row?.store_discount_active === true ||
      Number(row?.store_discount_active) === 1;
    if (!row || !isActive) return 0;
    return clampDiscountPercent(row.store_discount_percentage);
  } catch {
    return 0;
  }
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

const fetchBlogPost = async (slug) => {
  const [rows] = await dbPool.query(
    `SELECT slug, title, excerpt, image_url, is_published
       FROM blog_posts
      WHERE slug = ? AND is_published = TRUE
      LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
};

// Map a retail barcode (EAN-8 / UPC-A / EAN-13) to the matching Schema.org
// GTIN field so Google can associate the scanned code with this product page.
const barcodeToGtin = (barcode) => {
  const code = String(barcode || "").replace(/\D/g, "");
  if (code.length === 8) return { gtin8: code };
  if (code.length === 12) return { gtin12: code };
  if (code.length === 13) return { gtin13: code };
  return code ? { gtin: code } : {};
};

const buildProductMeta = (product, storeDiscountPct = 0, settings = null) => {
  const s = resolveSeoSettings(settings);
  const url = `${SITE_URL}/product/${product.id}`;
  const image = absoluteImage(product.image_url);
  const defaultProductDescription = getProductContentDefaults(product)?.description;
  const baseDescription =
    truncate(product.description) ||
    truncate(defaultProductDescription) ||
    `${product.name} — premium organic product from ${s.storeName}. Order online with SafePay or Cash on Delivery across Pakistan.`;
  // Surface the retail barcode in the description so a barcode/GTIN search can
  // match this exact product page.
  const description = product.barcode
    ? `${baseDescription} Product code: ${product.barcode}.`
    : baseDescription;
  const price = computeEffectiveProductPrice(product, storeDiscountPct);
  const availableStock =
    Number(product.stock_quantity || 0) - Number(product.reserved_stock || 0);

  const offers = {
    "@type": "Offer",
    url,
    priceCurrency: s.currency,
    availability:
      availableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  if (Number.isFinite(price)) {
    offers.price = price.toFixed(2);
  }

  const meta = {
    title: `${product.name} | ${s.storeName}`,
    description,
    url,
    image,
    imageAlt: `${product.name} — ${s.storeName}`,
    ogType: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: [image],
      description,
      // The stable internal identifier. Distinct from the GTIN: the GTIN is a
      // retail code that may or may not be ours, the SKU is always ours.
      sku: String(product.id),
      category: product.category_name || undefined,
      brand: { "@type": "Brand", name: s.storeName },
      ...barcodeToGtin(product.barcode),
      offers,
    },
  };

  meta.bodyHtml = productBodyHtml(product, meta, price, s);
  return meta;
};

// Active products for the crawlable link lists on / and /shop. The limit is a
// module constant rather than a bound parameter because MySQL will not accept a
// placeholder in LIMIT on a prepared statement.
const LINK_LIST_LIMIT = 100;

const fetchActiveProducts = async (categorySlug = null) => {
  if (categorySlug) {
    const [rows] = await dbPool.query(
      `SELECT p.id, p.name
         FROM products p
         JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1 AND p.deleted_at IS NULL AND c.slug = ?
        ORDER BY p.name ASC
        LIMIT ${LINK_LIST_LIMIT}`,
      [categorySlug],
    );
    return rows;
  }

  const [rows] = await dbPool.query(
    `SELECT id, name FROM products WHERE is_active = 1 AND deleted_at IS NULL ORDER BY name ASC LIMIT ${LINK_LIST_LIMIT}`,
  );
  return rows;
};

// Resolve { status, meta } for a request path.
const resolveMeta = async (reqPath) => {
  const pathname = (reqPath || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const seoSettings = await fetchSeoSettings();
  const staticPages = buildStaticPages(seoSettings);
  const complianceBodyFallbacks = buildComplianceBodyFallbacks(seoSettings);

  const staticPage = staticPages[pathname];
  if (staticPage) {
    const meta = {
      ...staticPage,
      url: `${SITE_URL}${pathname === "/" ? "/" : pathname}`,
    };

    // "/" and "/shop" are where Googlebot lands first, so they carry the
    // crawlable product links that let it reach every product page without
    // depending on the sitemap alone.
    if (pathname === "/" || pathname === "/shop") {
      const products = await fetchActiveProducts();
      if (products.length > 0) {
        meta.bodyHtml = linkListBodyHtml(
          pathname === "/"
            ? `${seoSettings.storeName} — Shop Organic & Natural Products`
            : "Shop All Products",
          products,
        );
      }
    } else if (complianceBodyFallbacks[pathname]) {
      meta.bodyHtml = complianceBodyFallbacks[pathname];
    }

    return { status: 200, meta };
  }

  if (NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return {
      status: 200,
      meta: {
        title: seoSettings.storeName,
        description: staticPages["/"].description,
        url: `${SITE_URL}${pathname}`,
        robots: "noindex, nofollow",
      },
    };
  }

  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const decoded = safeDecodeParam(productMatch[1]);
    const [product, storeDiscountPct] = decoded
      ? await Promise.all([fetchProduct(decoded), fetchActiveStoreDiscountPct()])
      : [null, 0];
    if (!product) {
      return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`, seoSettings) };
    }
    return { status: 200, meta: buildProductMeta(product, storeDiscountPct, seoSettings) };
  }

  const categoryMatch = pathname.match(/^\/shop\/([^/]+)$/);
  if (categoryMatch) {
    const decoded = safeDecodeParam(categoryMatch[1]);
    const category = decoded ? await fetchCategory(decoded) : null;
    if (!category) {
      return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`, seoSettings) };
    }
    const categoryProducts = await fetchActiveProducts(category.slug);
    const categoryFallbackDescription =
      CATEGORY_DESCRIPTION_DEFAULTS[String(category.slug || category.name || "").trim().toLowerCase()] ||
      `Shop ${category.name} at ${seoSettings.storeName}.`;
    return {
      status: 200,
      meta: {
        title: `${category.name} | ${seoSettings.storeName}`,
        description: truncate(category.description) || categoryFallbackDescription,
        url: `${SITE_URL}${pathname}`,
        image: category.image_url ? absoluteImage(category.image_url) : DEFAULT_OG_IMAGE,
        imageAlt: `${category.name} — ${seoSettings.storeName}`,
        bodyHtml:
          categoryProducts.length > 0
            ? linkListBodyHtml(category.name, categoryProducts)
            : undefined,
      },
    };
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const decoded = safeDecodeParam(blogMatch[1]);
    const blogPost = decoded ? await fetchBlogPost(decoded) : null;
    if (!blogPost) {
      return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`, seoSettings) };
    }
    return {
      status: 200,
      meta: {
        title: `${blogPost.title} | ${seoSettings.storeName}`,
        description: truncate(blogPost.excerpt) || staticPages["/blog"].description,
        image: blogPost.image_url ? absoluteImage(blogPost.image_url) : DEFAULT_OG_IMAGE,
        url: `${SITE_URL}${pathname}`,
      },
    };
  }

  // Anything else is a genuine 404 — return the correct status (no more soft-404s).
  return { status: 404, meta: notFoundMeta(`${SITE_URL}${pathname}`, seoSettings) };
};

const renderPage = async (reqPath, distDir) => {
  const template = loadTemplate(distDir);
  const { status, meta } = await resolveMeta(reqPath);
  return { status, html: applyMeta(template, meta) };
};

module.exports = {
  renderPage,
  computeEffectiveProductPrice,
  buildProductMeta,
};
