// Google Merchant Center product feed (RSS 2.0 + the "g:" Shopping namespace).
//
// Point Merchant Center's "Scheduled fetch" at GET /api/merchant-feed.xml — Google
// re-pulls this URL on the configured schedule, so no manual re-upload is needed
// as products, prices or stock change.
//
// Only products carrying a REAL, GS1-issued barcode get a <g:gtin>. Products still
// on the internal placeholder code (prefix 200-299, assigned automatically by
// utils/barcode.js when no real code has been entered yet) are submitted without a
// GTIN and with identifier_exists=no instead — that internal range is reserved for
// in-store use only, and is not a real, globally-unique product identifier.
const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const { getAdminSettings } = require('../utils/adminSettings');
const { getProductContentDefaults } = require('../utils/productContentDefaults');
const pool = db.promise();

const BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://naturanzafood.com').replace(/\/+$/, '');
const SITE_NAME = 'Naturanza Food';
const DEFAULT_IMAGE = `${BASE_URL}/images/og-image.jpg`;
const INTERNAL_BARCODE_PREFIX_RANGE = [200, 299];

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncate = (text, max = 5000) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

const absoluteImage = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_IMAGE;
  if (raw.startsWith('http')) return raw;
  return `${BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const isRealGtin = (barcode) => {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (!digits) return false;
  // EAN-8 / UPC-A codes are never auto-generated internally (only 13-digit EAN-13
  // is), so any non-13-digit code was pasted in by an admin and is real.
  if (digits.length !== 13) return true;
  const prefix = Number(digits.slice(0, 3));
  const [rangeStart, rangeEnd] = INTERNAL_BARCODE_PREFIX_RANGE;
  return !(prefix >= rangeStart && prefix <= rangeEnd);
};

const clampDiscountPercent = (value) =>
  Math.min(Math.max(Number(value) || 0, 0), 90);

const computeEffectiveFeedPrice = (product, storeDiscountPct = 0) => {
  const price = Number(product?.price) || 0;
  const perProductDiscount = clampDiscountPercent(product?.discount_percentage);
  const storeDiscount = clampDiscountPercent(storeDiscountPct);
  const effectiveDiscount = Math.max(perProductDiscount, storeDiscount);
  return price - (price * effectiveDiscount) / 100;
};

const fetchFeedProducts = async () => {
  const [products] = await pool.query(`
      SELECT id, name, description, image_url, price, discount_percentage,
             stock_quantity, reserved_stock, barcode
        FROM products
       WHERE is_active = 1
         AND deleted_at IS NULL
    ORDER BY id ASC
       LIMIT 5000
  `);

  return products;
};

const fetchActiveStoreDiscountPct = async (dbClient = pool) => {
  try {
    const [rows] = await dbClient.query(
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

const buildItemXml = (product, storeDiscountPct = 0, options = {}) => {
  const storeName = String(options?.storeName || SITE_NAME).trim() || SITE_NAME;
  const currency = String(options?.currency || 'PKR').trim().toUpperCase() || 'PKR';
  const link = `${BASE_URL}/product/${product.id}`;
  const finalPrice = computeEffectiveFeedPrice(product, storeDiscountPct).toFixed(2);
  const fallbackDescription = getProductContentDefaults(product)?.description;
  const description =
    truncate(product.description) ||
    truncate(fallbackDescription) ||
    `${product.name} — premium organic product from ${storeName}.`;
  const inStock = Number(product.stock_quantity || 0) - Number(product.reserved_stock || 0) > 0;
  const hasRealGtin = isRealGtin(product.barcode);

  let xml = `  <item>
    <g:id>${escapeXml(product.id)}</g:id>
    <title>${escapeXml(product.name)}</title>
    <description>${escapeXml(description)}</description>
    <link>${escapeXml(link)}</link>
    <g:image_link>${escapeXml(absoluteImage(product.image_url))}</g:image_link>
    <g:availability>${inStock ? 'in_stock' : 'out_of_stock'}</g:availability>
    <g:price>${finalPrice} ${escapeXml(currency)}</g:price>
    <g:condition>new</g:condition>
    <g:brand>${escapeXml(storeName)}</g:brand>`;

  if (hasRealGtin) {
    xml += `
    <g:gtin>${escapeXml(product.barcode)}</g:gtin>`;
  } else {
    xml += `
    <g:identifier_exists>no</g:identifier_exists>`;
  }

  xml += `
  </item>
`;
  return xml;
};

router.get('/merchant-feed.xml', async (req, res) => {
  try {
    const [products, settings] = await Promise.all([
      fetchFeedProducts(),
      getAdminSettings(pool).catch(() => null),
    ]);
    const storeDiscountPct = settings
      ? (settings.storeDiscountActive ? clampDiscountPercent(settings.storeDiscountPercentage) : 0)
      : await fetchActiveStoreDiscountPct();
    const storeName = String(settings?.storeName || SITE_NAME).trim() || SITE_NAME;
    const currency = String(settings?.currency || 'PKR').trim().toUpperCase() || 'PKR';
    const items = products
      .map((product) => buildItemXml(product, storeDiscountPct, { storeName, currency }))
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${escapeXml(storeName)} Product Feed</title>
  <link>${escapeXml(BASE_URL)}</link>
  <description>Product feed for Google Merchant Center</description>
${items}</channel>
</rss>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating merchant feed');
  }
});

router.clampDiscountPercent = clampDiscountPercent;
router.computeEffectiveFeedPrice = computeEffectiveFeedPrice;
router.fetchActiveStoreDiscountPct = fetchActiveStoreDiscountPct;
router.buildItemXml = buildItemXml;

module.exports = router;
