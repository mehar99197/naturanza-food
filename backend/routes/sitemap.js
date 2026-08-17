const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const pool = db.promise();

// Public site URL used in <loc> tags. Override via PUBLIC_SITE_URL env.
const BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://naturanzafood.com').replace(/\/+$/, '');

const toAbsoluteUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Static, always-indexable pages. Mirrors the route list in
// utils/seoRenderer.js's STATIC_PAGES so the two never drift apart silently —
// if a page is added there, add its <url> entry here too.
const STATIC_PAGES = [
  {
    loc: `${BASE_URL}/`,
    changefreq: 'daily',
    priority: 1.0,
    image: `${BASE_URL}/images/logo.png`,
    imageTitle: 'Naturanza Food Logo',
  },
  { loc: `${BASE_URL}/shop`, changefreq: 'daily', priority: 0.9 },
  { loc: `${BASE_URL}/about`, changefreq: 'monthly', priority: 0.6 },
  { loc: `${BASE_URL}/contact`, changefreq: 'monthly', priority: 0.7 },
  { loc: `${BASE_URL}/faq`, changefreq: 'monthly', priority: 0.6 },
  { loc: `${BASE_URL}/shipping`, changefreq: 'monthly', priority: 0.5 },
  { loc: `${BASE_URL}/returns`, changefreq: 'monthly', priority: 0.5 },
  { loc: `${BASE_URL}/terms`, changefreq: 'yearly', priority: 0.3 },
  { loc: `${BASE_URL}/privacy`, changefreq: 'yearly', priority: 0.3 },
  { loc: `${BASE_URL}/cookies`, changefreq: 'yearly', priority: 0.3 },
  { loc: `${BASE_URL}/blog`, changefreq: 'weekly', priority: 0.7 },
];

const fetchProductUrls = async () => {
  const [products] = await pool.query(`
      SELECT id, name, image_url, updated_at
        FROM products
       WHERE is_active = 1
    ORDER BY updated_at DESC
       LIMIT 1000
  `);

  return products.map((product) => ({
    loc: `${BASE_URL}/product/${product.id}`,
    lastmod: product.updated_at ? product.updated_at.toISOString().split('T')[0] : undefined,
    changefreq: 'weekly',
    priority: 0.7,
    image: toAbsoluteUrl(product.image_url),
    imageTitle: product.name,
  }));
};

// Categories only — callers that also want the /shop root append it themselves,
// since the combined sitemap already carries it via STATIC_PAGES.
const fetchCategoryUrls = async () => {
  const [categories] = await pool.query(
    `SELECT slug, name, image_url
       FROM categories
      WHERE is_active = TRUE
        AND category_type IN ('shop', 'both')
      ORDER BY name ASC`,
  );

  return categories.map((category) => ({
    loc: `${BASE_URL}/shop/${encodeURIComponent(category.slug)}`,
    changefreq: 'weekly',
    priority: 0.8,
    image: toAbsoluteUrl(category.image_url),
    imageTitle: category.name,
  }));
};

const fetchBlogUrls = async () => {
  const [posts] = await pool.query(
    `SELECT slug, image_url, DATE_FORMAT(updated_at, '%Y-%m-%d') AS lastmod
       FROM blog_posts
      WHERE is_published = TRUE
      ORDER BY published_at DESC`,
  );

  return posts.map((post) => ({
    loc: `${BASE_URL}/blog/${encodeURIComponent(post.slug)}`,
    lastmod: post.lastmod,
    changefreq: 'monthly',
    priority: 0.6,
    image: toAbsoluteUrl(post.image_url),
  }));
};

function buildXml(urls) {
  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
  urls.forEach(url => {
    xml += `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod || today)}</lastmod>
    <changefreq>${escapeXml(url.changefreq)}</changefreq>
    <priority>${escapeXml(url.priority)}</priority>`;
    if (url.image) {
      xml += `
    <image:image>
    <image:loc>${escapeXml(url.image)}</image:loc>
    <image:title>${escapeXml(url.imageTitle || 'Product Image')}</image:title>
    </image:image>`;
    }
    xml += `
  </url>
`;
  });
  xml += '</urlset>';
  return xml;
}

router.get('/sitemap/products', async (req, res) => {
  try {
    res.set('Content-Type', 'application/xml');
    res.send(buildXml(await fetchProductUrls()));
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/sitemap/categories', async (req, res) => {
  try {
    const urls = [
      ...(await fetchCategoryUrls()),
      { loc: `${BASE_URL}/shop`, changefreq: 'daily', priority: 0.9 },
    ];

    res.set('Content-Type', 'application/xml');
    res.send(buildXml(urls));
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// The canonical, comprehensive sitemap at the well-known root path. Google
// Search Console / robots.txt point here directly — it must contain every
// indexable URL on its own, not just link to sub-sitemaps, so a crawler never
// has to guess that /api/sitemap-index.xml exists to find product pages.
const fullSitemapHandler = async (req, res) => {
  try {
    const [productUrls, categoryUrls, blogUrls] = await Promise.all([
      fetchProductUrls(),
      fetchCategoryUrls(),
      fetchBlogUrls(),
    ]);

    const urls = [...STATIC_PAGES, ...categoryUrls, ...productUrls, ...blogUrls];

    res.set('Content-Type', 'application/xml');
    res.send(buildXml(urls));
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
};

router.get('/sitemap-index.xml', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/api/sitemap/categories</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/api/sitemap/products</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Attached to the router function itself so index.js can mount it at the
// root "/sitemap.xml" path, outside this router's "/api" prefix.
router.fullSitemapHandler = fullSitemapHandler;

module.exports = router;
