const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const pool = db.promise();

// Public site URL used in <loc> tags. Override via PUBLIC_SITE_URL env.
const BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://naturanzafood.com').replace(/\/+$/, '');
const CATEGORY_MAP = {
  honey: { name: 'Organic Honey', changefreq: 'weekly', priority: 0.8 },
  'herbal-teas': { name: 'Herbal Teas', changefreq: 'weekly', priority: 0.8 },
  supplements: { name: 'Natural Supplements', changefreq: 'weekly', priority: 0.8 },
  oils: { name: 'Natural Oils', changefreq: 'weekly', priority: 0.8 },
  seeds: { name: 'Organic Seeds', changefreq: 'weekly', priority: 0.8 }
};

function buildXml(urls) {
  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
  urls.forEach(url => {
    xml += `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod || today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>`;
    if (url.image) {
      xml += `
    <image:image>
      <image:loc>${url.image}</image:loc>
      <image:title>${url.imageTitle || 'Product Image'}</image:title>
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
    const [products] = await pool.query(`
      SELECT p.id, p.name, p.image_url, p.updated_at, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.updated_at DESC
      LIMIT 1000
    `);

    const urls = products.map(product => {
      const productUrl = `${BASE_URL}/product/${product.id}`;
      const imageUrl = product.image_url ? `${BASE_URL}${product.image_url}` : null;
      return {
        loc: productUrl,
        lastmod: product.updated_at ? product.updated_at.toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.7,
        image: imageUrl,
        imageTitle: product.name
      };
    });

    res.set('Content-Type', 'application/xml');
    res.send(buildXml(urls));
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

router.get('/sitemap/categories', async (req, res) => {
  try {
    const urls = Object.entries(CATEGORY_MAP).map(([slug, data]) => ({
      loc: `${BASE_URL}/shop/${slug}`,
      changefreq: data.changefreq,
      priority: data.priority
    }));

    urls.push({
      loc: `${BASE_URL}/shop`,
      changefreq: 'daily',
      priority: 0.9
    });

    res.set('Content-Type', 'application/xml');
    res.send(buildXml(urls));
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

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

module.exports = router;