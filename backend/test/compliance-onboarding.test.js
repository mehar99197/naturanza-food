/**
 * DB-free regression tests for Safepay onboarding & compliance fixes:
 * - Hero Slider single-source-of-truth pricing, discount, original price, category,
 *   headline spacing, and word-boundary excerpting.
 * - Category fallback descriptions (Honey, Ispaghol, Spices, custom DB override, unknown).
 * - FBR NTN business address & legal name consistency across frontend, backend, SEO, and PDFs.
 * - Compliance policy pages completeness (Shipping, Returns, Privacy, Terms).
 * - Spice product content defaults (Red Chili & Turmeric).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pathToFileURL } = require("node:url");

const backendRoot = path.join(__dirname, "..");
const frontendRoot = path.join(backendRoot, "..", "frontend");

const readFrontend = (relPath) =>
  fs.readFileSync(path.join(frontendRoot, relPath), "utf8");
const readBackend = (relPath) =>
  fs.readFileSync(path.join(backendRoot, relPath), "utf8");

const importFrontendModule = (relPath) =>
  import(pathToFileURL(path.join(frontendRoot, relPath)).href);

// Pure PKR pricing/formatting matching frontend/src/lib/utils.js so hero slide
// tests verify identical pricing logic without requiring Vite path aliases.
const clampPercent = (v) => Math.min(Math.max(Number(v) || 0, 0), 90);
const getProductPricing = (product, settings = {}) => {
  const base = Number(product?.price) || 0;
  const perProductPct = clampPercent(product?.discount_percentage);
  const storePct = settings?.storeDiscountActive
    ? clampPercent(settings?.storeDiscountPercentage)
    : 0;
  const effectivePct = Math.max(perProductPct, storePct);
  const salePrice = effectivePct > 0 ? base - (base * effectivePct) / 100 : base;
  return {
    base,
    salePrice,
    effectivePct: Math.round(effectivePct),
    onSale: effectivePct > 0 && salePrice < base,
    saved: base - salePrice,
    label: settings?.storeDiscountLabel || "Sale",
  };
};
const formatPrice = (amount) =>
  `Rs. ${Math.round(Number(amount)).toLocaleString("en-US")}`;

test("Hero slider binds pricing, original price, discount, and category per product with zero cross-slide leakage", async () => {
  const {
    buildHeroSlides,
    buildHeroSlideChips,
    splitHeadlineWords,
  } = await importFrontendModule("src/lib/heroSlideUtils.js");

  const products = [
    {
      id: 10,
      name: "Turmeric (Pure Organic Haldi) 200g",
      slug: "turmeric-pure-organic-haldi-200g",
      price: "420.00",
      discount_percentage: "0.00",
      category_name: "Spices",
      description: null,
      is_active: 1,
      is_featured: 1,
      is_in_stock: true,
    },
    {
      id: 9,
      name: "Red Chili (Lal Mirch) 200g",
      slug: "red-chili-lal-mirch-200g",
      price: "350.00",
      discount_percentage: "0.00",
      category_name: "Spices",
      description: null,
      is_active: 1,
      is_featured: 1,
      is_in_stock: true,
    },
    {
      id: 5,
      name: "Almond Infused Honey 500g",
      slug: "almond-infused-honey-500g",
      price: "2500.00",
      discount_percentage: "20.00",
      category_name: "Honey",
      description:
        "Pure natural honey from mountain farms, carefully harvested to deliver rich taste and everyday wellness support.",
      is_active: 1,
      is_featured: 1,
      is_in_stock: true,
      average_rating: 4.9,
      review_count: 14,
    },
    {
      id: 4,
      name: "Sandal Infused Honey 500g",
      slug: "sandal-infused-honey-500g",
      price: "2000.00",
      discount_percentage: "10.00",
      category_name: "Honey",
      description:
        "Pure natural honey from mountain farms, carefully harvested to deliver rich taste and everyday wellness support.",
      is_active: 1,
      is_featured: 1,
      is_in_stock: true,
    },
    {
      id: 3,
      name: "Ispaghol Husk 80g",
      slug: "ispaghol-husk-80g",
      price: "1000.00",
      discount_percentage: "10.00",
      category_name: "Ispaghol",
      description:
        "Natural ispaghol husk fiber that supports digestive comfort, gentle regularity, and daily gut wellness.",
      is_active: 1,
      is_featured: 1,
      is_in_stock: true,
    },
  ];

  const settings = {
    currency: "PKR",
    storeDiscountActive: true,
    storeDiscountPercentage: 0,
  };

  const slides = buildHeroSlides(products);
  assert.equal(slides.length, 5);

  const byId = new Map(slides.map((s) => [s.id, s]));

  // Ispaghol Husk 80g must show Rs. 900 (was Rs. 1,000, 10% OFF) and category Ispaghol — never Rs. 1,800 / Honey
  const ispagholChips = buildHeroSlideChips(byId.get(3), settings, {
    getProductPricing,
    formatPrice,
  });
  assert.deepEqual(
    ispagholChips.find((c) => c.key === "sale")?.label,
    "10% OFF",
  );
  assert.deepEqual(
    ispagholChips.find((c) => c.key === "price")?.label,
    "Rs. 900",
  );
  assert.deepEqual(
    ispagholChips.find((c) => c.key === "price")?.originalLabel,
    "Rs. 1,000",
  );
  assert.deepEqual(
    ispagholChips.find((c) => c.key === "category")?.label,
    "Ispaghol",
  );

  // Almond Infused Honey 500g must show Rs. 2,000 (was Rs. 2,500, 20% OFF) and retain category Honey even with reviews
  const almondChips = buildHeroSlideChips(byId.get(5), settings, {
    getProductPricing,
    formatPrice,
  });
  assert.equal(almondChips.find((c) => c.key === "sale")?.label, "20% OFF");
  assert.equal(almondChips.find((c) => c.key === "price")?.label, "Rs. 2,000");
  assert.equal(
    almondChips.find((c) => c.key === "price")?.originalLabel,
    "Rs. 2,500",
  );
  assert.equal(almondChips.find((c) => c.key === "category")?.label, "Honey");
  assert.equal(almondChips.find((c) => c.key === "rating")?.label, "4.9 (14)");

  // Sandal Infused Honey 500g: Rs. 1,800 (was Rs. 2,000, 10% OFF)
  const sandalChips = buildHeroSlideChips(byId.get(4), settings, {
    getProductPricing,
    formatPrice,
  });
  assert.equal(sandalChips.find((c) => c.key === "sale")?.label, "10% OFF");
  assert.equal(sandalChips.find((c) => c.key === "price")?.label, "Rs. 1,800");
  assert.equal(
    sandalChips.find((c) => c.key === "price")?.originalLabel,
    "Rs. 2,000",
  );

  // Non-discounted spices get exact price (no "From"), category Spices, and non-placeholder descriptions
  const chiliChips = buildHeroSlideChips(byId.get(9), settings, {
    getProductPricing,
    formatPrice,
  });
  assert.equal(chiliChips.find((c) => c.key === "sale"), undefined);
  assert.equal(chiliChips.find((c) => c.key === "price")?.label, "Rs. 350");
  assert.equal(chiliChips.find((c) => c.key === "price")?.originalLabel, null);
  assert.equal(chiliChips.find((c) => c.key === "category")?.label, "Spices");
  assert.match(byId.get(9).description, /red chili/i);
  assert.match(byId.get(10).description, /turmeric/i);

  // Store-wide sale larger than product discount takes effect consistently
  const saleSettings = {
    currency: "PKR",
    storeDiscountActive: true,
    storeDiscountPercentage: 25,
  };
  const saleIspagholChips = buildHeroSlideChips(byId.get(3), saleSettings, {
    getProductPricing,
    formatPrice,
  });
  assert.equal(saleIspagholChips.find((c) => c.key === "sale")?.label, "25% OFF");
  assert.equal(saleIspagholChips.find((c) => c.key === "price")?.label, "Rs. 750");
  assert.equal(
    saleIspagholChips.find((c) => c.key === "price")?.originalLabel,
    "Rs. 1,000",
  );

  // Headline words preserve proper spaces
  assert.equal(
    splitHeadlineWords(byId.get(5).headline).join(" "),
    "Almond Infused Honey 500g",
  );
  assert.deepEqual(splitHeadlineWords("  Almond   Infused\tHoney  500g "), [
    "Almond",
    "Infused",
    "Honey",
    "500g",
  ]);
  assert.deepEqual(splitHeadlineWords(""), []);

  // Descriptions never truncate mid-word like "everyday welln" / "daily gut wellne"
  assert.equal(
    byId.get(5).description,
    "Pure natural honey from mountain farms, carefully harvested to deliver rich taste and everyday wellness support.",
  );
  assert.equal(
    byId.get(3).description,
    "Natural ispaghol husk fiber that supports digestive comfort, gentle regularity, and daily gut wellness.",
  );
});

test("createCleanExcerpt handles boundary lengths, long text, punctuation, and empty inputs without mid-word cuts", async () => {
  const { createCleanExcerpt } = await importFrontendModule("src/lib/heroSlideUtils.js");

  assert.equal(createCleanExcerpt(""), "");
  assert.equal(createCleanExcerpt(null), "");
  assert.equal(createCleanExcerpt("   "), "");

  const exact155 = "a".repeat(155);
  assert.equal(createCleanExcerpt(exact155, 155), exact155);

  const longText =
    "Pure natural mountain honey harvested carefully from high-altitude floral meadows across northern Pakistan, delivering smooth aroma, rich taste, and everyday wellness support for your whole family.";
  const excerpt = createCleanExcerpt(longText, 120);
  assert.ok(excerpt.endsWith("\u2026"));
  assert.ok(excerpt.length <= 121);
  // Every word before the ellipsis must be a complete word from the original text
  const withoutEllipsis = excerpt.slice(0, -1);
  assert.ok(
    longText.startsWith(withoutEllipsis),
    "excerpt prefix must match original text",
  );
  const nextCharInOriginal = longText[withoutEllipsis.length];
  assert.ok(
    [" ", ",", ";", ":", "-"].includes(nextCharInOriginal),
    `must cut at a word boundary, not mid-word (next char was ${JSON.stringify(nextCharInOriginal)})`,
  );
});

test("Category fallback descriptions replace placeholder copy for Honey, Ispaghol, Spices, and unknown categories", async () => {
  const { getCategoryDescription } = await importFrontendModule(
    "src/lib/categoryDefaults.js",
  );

  assert.equal(
    getCategoryDescription({ id: 3, name: "Honey", slug: "honey", description: null }),
    "Pure, raw, and naturally infused honey harvested from trusted mountain farms.",
  );
  assert.equal(
    getCategoryDescription({ id: 2, name: "Ispaghol", slug: "ispaghol", description: "" }),
    "Natural psyllium husk fiber supporting everyday digestion and gut health.",
  );
  assert.equal(
    getCategoryDescription({ id: 4, name: "Spices", slug: "spices", description: "   " }),
    "100% pure, chemical-free organic spices freshly ground for authentic taste.",
  );
  // Non-empty DB description takes precedence over fallback
  assert.equal(
    getCategoryDescription({
      id: 3,
      name: "Honey",
      slug: "honey",
      description: "Custom admin honey description.",
    }),
    "Custom admin honey description.",
  );
  // Unknown and empty categories never emit placeholder copy
  const unknownDesc = getCategoryDescription({ name: "Herbal Teas", slug: "herbal-teas", description: null });
  assert.ok(unknownDesc.length > 15);
  assert.doesNotMatch(unknownDesc, /no description/i);

  const emptyDesc = getCategoryDescription({});
  assert.ok(emptyDesc.length > 15);
  assert.doesNotMatch(emptyDesc, /no description/i);

  // Storefront Categories component has no placeholder string
  const categoriesSource = readFrontend("src/sections/Categories.jsx");
  assert.doesNotMatch(categoriesSource, /No description added yet/i);
});

test("Business address, legal name, and compliance policy configs match FBR NTN and Safepay requirements", async () => {
  const { BUSINESS_INFO, SHIPPING_POLICY, RETURNS_POLICY } =
    await importFrontendModule("src/config/legal.js");

  const expectedAddress = "Nizam Pura, Chunian, District Kasur, Punjab, Pakistan";
  assert.equal(BUSINESS_INFO.brandName, "Naturanza Food");
  assert.equal(BUSINESS_INFO.legalName, "Naturanza Foods");
  assert.equal(BUSINESS_INFO.officeAddress, expectedAddress);
  assert.equal(BUSINESS_INFO.contacts.supportEmail, "support@naturanzafood.com");
  assert.equal(BUSINESS_INFO.contacts.phone, "+92340 9502646");

  assert.equal(SHIPPING_POLICY.standardWindow, "3\u20135 working days");
  assert.equal(SHIPPING_POLICY.freeShippingThreshold, "Rs. 5,000");
  assert.equal(SHIPPING_POLICY.freeShippingThresholdAmount, 5000);

  assert.equal(RETURNS_POLICY.returnWindow, "7 days");
  assert.equal(RETURNS_POLICY.returnWindowDays, 7);
  assert.equal(RETURNS_POLICY.refundWindow, "5\u20137 business days");

  // Backend adminSettings defaults align with FBR NTN address
  const { DEFAULT_ADMIN_SETTINGS } = require("../utils/adminSettings");
  assert.equal(DEFAULT_ADMIN_SETTINGS.address, expectedAddress);
  assert.equal(DEFAULT_ADMIN_SETTINGS.mapLocationLabel, expectedAddress);
  assert.equal(DEFAULT_ADMIN_SETTINGS.shippingFree, 5000);

  // Frontend metadata & components carry FBR address and zero stale addresses
  const filesToCheck = [
    "index.html",
    "src/components/Footer.jsx",
    "src/components/SEO.jsx",
    "src/components/StructuredData.jsx",
    "src/context/SettingsContext.jsx",
    "src/pages/Contact.jsx",
    "src/pages/Shipping.jsx",
    "src/pages/Returns.jsx",
    "src/pages/Privacy.jsx",
    "src/pages/Terms.jsx",
  ];
  for (const rel of filesToCheck) {
    const src = readFrontend(rel);
    assert.doesNotMatch(src, /Pattoki|Chak No 2|Cedar Tower/i, `${rel} must not contain stale address`);
    assert.doesNotMatch(src, /upload a payment screenshot/i, `${rel} must not contain legacy screenshot copy`);
  }

  // Hero component renders actual spaces between headline words, preserves text contrast,
  // separates sale/original prices with whitespace, and has no .substring(0, 100)
  const heroSource = readFrontend("src/sections/Hero.jsx");
  assert.doesNotMatch(heroSource, /\.substring\(0,\s*100\)/);
  assert.match(heroSource, /i > 0 \? ' ' : ''/);
  assert.match(heroSource, /line-clamp-2/);
  assert.match(heroSource, /truncate text-current/);
  assert.match(heroSource, /<span className="text-current">\{slide\.ctaPrimary\}<\/span>/);
  assert.match(heroSource, /md:grid md:grid-cols-2/);

  // PostalAddress components must not duplicate "Chunian" across streetAddress + addressLocality
  assert.equal(BUSINESS_INFO.addressComponents.streetAddress, "Nizam Pura");
  assert.equal(BUSINESS_INFO.addressComponents.addressLocality, "Chunian, District Kasur");
  const indexHtml = readFrontend("index.html");
  assert.match(indexHtml, /"streetAddress": "Nizam Pura"/);

  // Contact page falls back to Chunian coordinates (not Lahore) and shows legal name
  const contactSource = readFrontend("src/pages/Contact.jsx");
  assert.doesNotMatch(contactSource, /31\.5204|74\.3587/);
  assert.match(contactSource, /30\.9716931/);
  assert.match(contactSource, /BUSINESS_INFO\.legalName/);

  // Policy pages & Checkout align free-shipping wording with actual prepaid/SafePay rule
  const shippingSource = readFrontend("src/pages/Shipping.jsx");
  assert.match(shippingSource, /Prepaid online orders \(via SafePay\)/i);
  assert.match(shippingSource, /Cash on Delivery \(COD\) orders carry/i);
  const checkoutSource = readFrontend("src/pages/Checkout.jsx");
  assert.match(checkoutSource, /Free with online payment \(SafePay\)/i);

  // database.sql fresh-install defaults match FBR address (not Lahore)
  const schemaSql = readBackend("schema/database.sql");
  assert.doesNotMatch(schemaSql, /DEFAULT 'Pakistan, Lahore'/);
  assert.match(schemaSql, /DEFAULT 'Nizam Pura, Chunian, District Kasur, Punjab, Pakistan'/);

  // Policy pages render legal name, address, email, and phone
  for (const policyPage of [
    "src/pages/Shipping.jsx",
    "src/pages/Returns.jsx",
    "src/pages/Privacy.jsx",
    "src/pages/Terms.jsx",
  ]) {
    const src = readFrontend(policyPage);
    assert.match(src, /BUSINESS_INFO\.legalName/, `${policyPage} must display legal name`);
    assert.match(src, /BUSINESS_INFO\.officeAddress/, `${policyPage} must display FBR address`);
    assert.match(src, /mailto:/, `${policyPage} must provide clickable support email`);
    assert.match(src, /tel:/, `${policyPage} must provide clickable support phone`);
  }
});

test("Invoice PDF defaults use Naturanza Foods, FBR address, and formatted SafePay label", async () => {
  const invoiceSource = readBackend("utils/invoicePdf.js");
  assert.doesNotMatch(invoiceSource, /Cedar Tower|Gulberg III|Naturanza Wellness Pvt/i);
  assert.match(invoiceSource, /Naturanza Foods/);
  assert.match(invoiceSource, /Nizam Pura, Chunian, District Kasur, Punjab, Pakistan/);
  assert.match(invoiceSource, /7-day returns/);

  const { createInvoicePdfBuffer, getPaymentMethodLabel } = require("../utils/invoicePdf");
  assert.equal(getPaymentMethodLabel("safepay"), "SafePay (Online Payment)");
  assert.equal(getPaymentMethodLabel("cod"), "Cash on Delivery");
  const buffer = await createInvoicePdfBuffer({
    id: 101,
    customer_name: "Test Buyer",
    customer_email: "buyer@example.com",
    shipping_address: "House 1, Model Town",
    city: "Lahore",
    phone: "+923001234567",
    payment_method: "safepay",
    status: "confirmed",
    subtotal: 2000,
    tax: 0,
    shipping_cost: 250,
    discount_amount: 0,
    total_amount: 2250,
    items: [{ product_name: "Almond Infused Honey 500g", quantity: 1, price: 2000 }],
  });
  assert.ok(Buffer.isBuffer(buffer) && buffer.length > 1000, "PDF buffer must be generated");
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
});

test("SSR seoRenderer emits discounted sale price, available stock, and spice fallback descriptions", () => {
  const { computeEffectiveProductPrice, buildProductMeta } = require("../utils/seoRenderer");

  // Almond Infused Honey 500g: 2500 with 20% off => 2000.00
  const almondMeta = buildProductMeta({
    id: 5,
    name: "Almond Infused Honey 500g",
    slug: "almond-infused-honey-500g",
    price: "2500.00",
    discount_percentage: "20.00",
    stock_quantity: 10,
    reserved_stock: 2,
    category_name: "Honey",
    category_slug: "honey",
    description: "Pure natural honey from mountain farms.",
  });
  assert.equal(almondMeta.jsonLd.offers.price, "2000.00");
  assert.equal(almondMeta.jsonLd.offers.availability, "https://schema.org/InStock");
  assert.match(almondMeta.bodyHtml, /2000\.00/);

  // Ispaghol Husk 80g: 1000 with 10% off => 900.00; store-wide 25% overrides => 750.00
  assert.equal(
    computeEffectiveProductPrice({ price: "1000.00", discount_percentage: "10.00" }, 0),
    900,
  );
  assert.equal(
    computeEffectiveProductPrice({ price: "1000.00", discount_percentage: "10.00" }, 25),
    750,
  );

  // Fully reserved stock reports OutOfStock
  const reservedOut = buildProductMeta({
    id: 3,
    name: "Ispaghol Husk 80g",
    slug: "ispaghol-husk-80g",
    price: "1000.00",
    discount_percentage: "10.00",
    stock_quantity: 5,
    reserved_stock: 5,
    category_name: "Ispaghol",
    category_slug: "ispaghol",
  });
  assert.equal(reservedOut.jsonLd.offers.price, "900.00");
  assert.equal(reservedOut.jsonLd.offers.availability, "https://schema.org/OutOfStock");

  // NULL description for Red Chili uses spice content default
  const chiliMeta = buildProductMeta({
    id: 9,
    name: "Red Chili (Lal Mirch) 200g",
    slug: "red-chili-lal-mirch-200g",
    price: "350.00",
    discount_percentage: "0.00",
    stock_quantity: 10,
    reserved_stock: 0,
    description: null,
  });
  assert.match(chiliMeta.description, /red chili/i);
  assert.equal(chiliMeta.jsonLd.offers.price, "350.00");
});

test("Backend productContentDefaults covers Red Chili and Turmeric without false-matching unrelated oils", () => {
  const { getProductContentDefaults } = require("../utils/productContentDefaults");

  const chiliOld = getProductContentDefaults({
    name: "red chili(lal marach) 200g",
    slug: "red-chili-lal-marach-200g",
  });
  assert.ok(chiliOld);
  assert.match(chiliOld.description, /red chili/i);

  const chiliPolished = getProductContentDefaults({
    name: "Red Chili (Lal Mirch) 200g",
    slug: "red-chili-lal-mirch-200g",
  });
  assert.ok(chiliPolished);
  assert.match(chiliPolished.description, /red chili/i);

  const turmericPolished = getProductContentDefaults({
    name: "Turmeric (Pure Organic Haldi) 200g",
    slug: "turmeric-pure-organic-haldi-200g",
  });
  assert.ok(turmericPolished);
  assert.match(turmericPolished.description, /turmeric/i);

  assert.equal(
    getProductContentDefaults({ name: "Organic Olive Oil", slug: "organic-olive-oil" }),
    null,
  );
});

const extractPdfText = (pdfBuffer) => {
  const lines = [];
  const streamMarker = Buffer.from("stream\n");
  const endMarker = Buffer.from("\nendstream");
  let offset = 0;

  while (offset < pdfBuffer.length) {
    const startIdx = pdfBuffer.indexOf(streamMarker, offset);
    if (startIdx === -1) break;
    const dataStart = startIdx + streamMarker.length;
    const endIdx = pdfBuffer.indexOf(endMarker, dataStart);
    if (endIdx === -1) break;
    const streamSlice = pdfBuffer.subarray(dataStart, endIdx);
    try {
      const inflated = zlib.inflateSync(streamSlice).toString("latin1");
      if (inflated.includes("BT") && inflated.includes("TJ")) {
        const tjBlocks = inflated.match(/\[[^\]]*\]\s*TJ/g) || [];
        for (const block of tjBlocks) {
          const decoded = (block.match(/<([0-9a-fA-F]+)>/g) || [])
            .map((hex) => Buffer.from(hex.slice(1, -1), "hex").toString("latin1"))
            .join("");
          if (decoded) lines.push(decoded);
        }
      }
    } catch {
      // Non-FlateDecode stream (e.g., embedded image data); skip.
    }
    offset = endIdx + endMarker.length;
  }

  return lines.join("\n");
};

test("ProductDetail renders dynamic product benefits, Chemical-Free, and policy-accurate mobile shipping badge", async () => {
  const productDetailSource = readFrontend("src/pages/ProductDetail.jsx");

  // No unrelated supplement template claims, cosmetics template badges, or placeholder copy
  assert.doesNotMatch(
    productDetailSource,
    /Reduces Stress|Improves Sleep Quality|Balances Mood Naturally|Boosts Energy & Focus|Supports Immune Health/i,
  );
  assert.doesNotMatch(productDetailSource, /Cruelty-Free/i);
  assert.doesNotMatch(productDetailSource, />\s*Free Shipping\s*</);
  assert.doesNotMatch(productDetailSource, /Benefits are not provided yet/i);
  assert.doesNotMatch(productDetailSource, /Ingredients are not provided yet/i);

  // All unused icon imports removed (Moon, Smile, Zap)
  assert.doesNotMatch(productDetailSource, /\bMoon\b/);
  assert.doesNotMatch(productDetailSource, /\bSmile\b/);
  assert.doesNotMatch(productDetailSource, /\bZap\b/);

  // ProductDetail delegates dynamic resolution to resolveProductContent and renders keyBenefits + Chemical-Free
  assert.match(productDetailSource, /resolveProductContent/);
  assert.match(productDetailSource, /keyBenefits\.map\(/);
  assert.match(productDetailSource, /displayedBenefits\.map\(/);
  assert.match(productDetailSource, /Chemical-Free/);

  const {
    DEFAULT_KEY_BENEFITS,
    parseProductListField,
    resolveProductContent,
  } = await importFrontendModule("src/lib/productDetailUtils.js");

  assert.deepEqual(DEFAULT_KEY_BENEFITS, [
    "100% Pure & Natural",
    "No Artificial Additives",
    "Hygienically Packed",
    "Nationwide Delivery",
  ]);

  // Spices, honey, and ispaghol resolve intact product-specific sentences without comma-splitting fragments
  const chiliResolved = resolveProductContent({
    name: "Red Chili (Lal Mirch) 200g",
    slug: "red-chili-lal-mirch-200g",
    benefits: null,
    usage: null,
  });
  assert.equal(chiliResolved.keyBenefits.length, 3);
  assert.equal(chiliResolved.isCompactKeyBenefits, false);
  assert.ok(
    chiliResolved.keyBenefits.includes(
      "Free from artificial dyes, fillers, and chemical preservatives",
    ),
    "Red Chili benefit sentence must not be split on commas",
  );
  assert.ok(!chiliResolved.keyBenefits.includes("fillers"));
  assert.ok(!chiliResolved.keyBenefits.includes("and chemical preservatives"));
  assert.equal(chiliResolved.usage.length, 3);

  // Backfilled newline-separated DB strings with commas must also stay intact
  const turmericBackfilled = resolveProductContent({
    name: "Turmeric (Pure Organic Haldi) 200g",
    slug: "turmeric-pure-organic-haldi-200g",
    benefits: [
      "Naturally rich in curcumin and antioxidants",
      "Free from artificial colors, starch fillers, and chemical additives",
      "Ideal for everyday cooking, golden milk, and wellness routines",
    ].join("\n"),
    usage: [
      "Add to curries, soups, rice dishes, and marinades for warm flavor and color.",
      "Stir half a teaspoon into warm milk for traditional golden milk.",
      "Store in an airtight container away from moisture and direct sunlight.",
    ].join("\n"),
  });
  assert.equal(turmericBackfilled.keyBenefits.length, 3);
  assert.ok(
    turmericBackfilled.keyBenefits.includes(
      "Free from artificial colors, starch fillers, and chemical additives",
    ),
  );
  assert.ok(
    turmericBackfilled.keyBenefits.includes(
      "Ideal for everyday cooking, golden milk, and wellness routines",
    ),
  );
  assert.ok(!turmericBackfilled.keyBenefits.includes("starch fillers"));
  assert.ok(!turmericBackfilled.keyBenefits.includes("and chemical additives"));
  assert.equal(turmericBackfilled.usage.length, 3);

  const honeyResolved = resolveProductContent({
    name: "Almond Infused Honey 500g",
    slug: "almond-infused-honey-500g",
    benefits: "   ", // whitespace DB field must still fall back to honey defaults
    usage: "[]", // empty JSON DB field must still fall back to honey defaults
  });
  assert.equal(honeyResolved.keyBenefits.length, 3);
  assert.ok(
    honeyResolved.keyBenefits.includes(
      "A soothing everyday sweetener for tea, toast, and warm drinks",
    ),
  );
  assert.ok(!honeyResolved.keyBenefits.includes("toast"));
  assert.equal(honeyResolved.usage.length, 3);

  const ispagholResolved = resolveProductContent({
    name: "Ispaghol Husk 80g",
    slug: "ispaghol-husk-80g",
    benefits: [],
  });
  assert.equal(ispagholResolved.keyBenefits.length, 3);
  assert.equal(ispagholResolved.usage.length, 3);
  assert.doesNotMatch(
    [
      ...chiliResolved.keyBenefits,
      ...turmericBackfilled.keyBenefits,
      ...honeyResolved.keyBenefits,
      ...ispagholResolved.keyBenefits,
    ].join(" "),
    /stress|anxiety|sleep|mood/i,
  );

  // Unknown products with empty DB benefits fall back cleanly in both keyBenefits & displayedBenefits
  const unknownResolved = resolveProductContent({
    name: "Wild Mountain Shilajit Resin",
    slug: "wild-mountain-shilajit-resin",
    benefits: "",
  });
  assert.deepEqual(unknownResolved.keyBenefits, DEFAULT_KEY_BENEFITS);
  assert.deepEqual(unknownResolved.displayedBenefits, DEFAULT_KEY_BENEFITS);
  assert.equal(unknownResolved.isCompactKeyBenefits, true);

  // Admin single-line comma-separated tags still split, while Oxford-comma prose & arrays stay intact
  assert.deepEqual(
    parseProductListField("100% Pure, No Additives, Freshly Ground", {
      allowSingleLineComma: true,
      preserveClauses: true,
    }),
    ["100% Pure", "No Additives", "Freshly Ground"],
  );
  assert.deepEqual(
    parseProductListField("Free from artificial dyes, fillers, and chemical preservatives", {
      allowSingleLineComma: true,
      preserveClauses: true,
    }),
    ["Free from artificial dyes, fillers, and chemical preservatives"],
  );
  assert.deepEqual(
    parseProductListField(["Free from dyes, fillers, and preservatives", "Freshly ground"]),
    ["Free from dyes, fillers, and preservatives", "Freshly ground"],
  );
  assert.deepEqual(
    parseProductListField("Store in a cool, dry place.", { allowSingleLineComma: false }),
    ["Store in a cool, dry place."],
  );
});

test("Footer newsletter Subscribe button has explicit text-white contrast", () => {
  const footerSource = readFrontend("src/components/Footer.jsx");
  const subscribeButtonMatch = footerSource.match(
    /<button[\s\S]*?type="submit"[\s\S]*?>[\s\S]*?Subscribing\.\.\.[\s\S]*?<\/button>/,
  );
  assert.ok(subscribeButtonMatch, "Footer must contain newsletter submit button");
  assert.match(
    subscribeButtonMatch[0],
    /\btext-white\b/,
    "Footer newsletter Subscribe button must specify text-white for contrast on green gradient",
  );
});

test("Free-shipping wording consistently specifies prepaid online orders over Rs. 5,000 across UI, SEO, SSR, and Login", () => {
  const featuresSource = readFrontend("src/sections/Features.jsx");
  assert.match(featuresSource, /3–5 working days delivery across Pakistan/i);
  assert.match(featuresSource, /free shipping on prepaid online orders over/i);
  assert.match(featuresSource, /parsedShippingFree > 0/);
  assert.doesNotMatch(featuresSource, /Free shipping on orders over/i);

  const seoSource = readFrontend("src/components/SEO.jsx");
  const homeSeoBlock = seoSource.match(/export function HomeSEO[\s\S]*?\n\}/)?.[0] || "";
  const shippingSeoBlock = seoSource.match(/export function ShippingSEO[\s\S]*?\n\}/)?.[0] || "";
  assert.match(homeSeoBlock, /Free shipping on prepaid online orders over Rs\. 5,000 across Pakistan/i);
  assert.match(shippingSeoBlock, /free shipping on prepaid online orders over Rs\. 5,000/i);
  assert.doesNotMatch(seoSource, /free shipping on orders over Rs\. 5,000/i);

  const seoRendererSource = readBackend("utils/seoRenderer.js");
  assert.match(
    seoRendererSource,
    /Free shipping on prepaid online orders over Rs\. 5,000 across Pakistan/i,
  );
  assert.match(
    seoRendererSource,
    /3–5 working days delivery across Pakistan and free shipping on prepaid online orders over Rs\. 5,000/i,
  );
  assert.doesNotMatch(seoRendererSource, /free shipping on orders over Rs\. 5,000/i);

  const indexHtml = readFrontend("index.html");
  assert.match(
    indexHtml,
    /<meta name="description"[^>]*Free shipping on prepaid online orders over Rs\. 5,000 across Pakistan/i,
  );
  assert.match(
    indexHtml,
    /<meta property="og:description"[^>]*Free shipping on prepaid online orders over Rs\. 5,000/i,
  );
  assert.doesNotMatch(indexHtml, /Free shipping on Rs\. 5,000\+/i);
  assert.doesNotMatch(indexHtml, /Free shipping on orders over Rs\. 5,000/i);

  const loginSource = readFrontend("src/pages/Login.jsx");
  assert.match(loginSource, /Free Delivery on Prepaid Online Orders Over Rs\. 5,000/);
  assert.doesNotMatch(loginSource, /"Free Delivery on Orders Over Rs\. 5,000"/);

  const adminSettingsSource = readFrontend("src/pages/AdminSettings.jsx");
  assert.doesNotMatch(adminSettingsSource, /31\.5204|74\.3587/);
  assert.match(adminSettingsSource, /placeholder="30\.9716931"/);
  assert.match(adminSettingsSource, /placeholder="73\.8896874"/);
});

test("Invoice generation preserves registered legal entity Naturanza Foods alongside storeName override", async () => {
  const ordersRouteSource = readBackend("routes/orders.js");
  assert.doesNotMatch(
    ordersRouteSource,
    /legalName:\s*(?:adminSettings\.)?storeName/,
    "orders route must not overwrite legalName with storefront storeName",
  );
  assert.match(
    ordersRouteSource,
    /storeName\s*\?\s*\{\s*brandName:\s*storeName\s*\}/,
  );

  const envExampleSource = readBackend(".env.example");
  assert.match(envExampleSource, /^BUSINESS_BRAND_NAME=Naturanza Food$/m);
  assert.match(envExampleSource, /^BUSINESS_LEGAL_NAME=Naturanza Foods$/m);

  const { createInvoicePdfBuffer, resolveInvoiceCompany } = require("../utils/invoicePdf");

  const prevLegalName = process.env.BUSINESS_LEGAL_NAME;
  const prevBrandName = process.env.BUSINESS_BRAND_NAME;
  delete process.env.BUSINESS_LEGAL_NAME;
  delete process.env.BUSINESS_BRAND_NAME;

  try {
    // Default company resolution (independent of local .env values)
    const defaults = resolveInvoiceCompany();
    assert.equal(defaults.legalName, "Naturanza Foods");
    assert.equal(defaults.brandName, "Naturanza Food");
    assert.equal(defaults.displayName, "Naturanza Food (Naturanza Foods)");

    // Storefront storeName override ("Naturanza Food") preserves legal entity ("Naturanza Foods")
    const withStoreName = resolveInvoiceCompany({ brandName: "Naturanza Food" });
    assert.equal(withStoreName.legalName, "Naturanza Foods");
    assert.equal(withStoreName.displayName, "Naturanza Food (Naturanza Foods)");

    // Equal brandName and legalName avoid duplication
    assert.equal(
      resolveInvoiceCompany({ brandName: "Naturanza Foods" }).displayName,
      "Naturanza Foods",
    );

    // brandName already containing legalName avoids duplicate parentheses
    assert.equal(
      resolveInvoiceCompany({ brandName: "Naturanza Food (Naturanza Foods)" }).displayName,
      "Naturanza Food (Naturanza Foods)",
    );

    // Empty brandName or blank legalName still resolves cleanly to registered legal entity
    assert.equal(resolveInvoiceCompany({ brandName: "" }).displayName, "Naturanza Foods");
    assert.equal(
      resolveInvoiceCompany({ brandName: "Naturanza Food", legalName: "   " }).displayName,
      "Naturanza Food (Naturanza Foods)",
    );

    // Whitespace env vars and blank/undefined overrides never emit blank/undefined fields
    process.env.BUSINESS_LEGAL_NAME = "   ";
    process.env.BUSINESS_BRAND_NAME = "   ";
    const fromBlankEnvAndOverrides = resolveInvoiceCompany({
      brandName: "Naturanza Food",
      email: "",
      phone: undefined,
      officeAddress: "   ",
      website: null,
    });
    assert.equal(fromBlankEnvAndOverrides.legalName, "Naturanza Foods");
    assert.equal(fromBlankEnvAndOverrides.displayName, "Naturanza Food (Naturanza Foods)");
    assert.equal(fromBlankEnvAndOverrides.email, "support@naturanzafood.com");
    assert.ok(fromBlankEnvAndOverrides.phone.includes("9502646"));
    assert.equal(
      fromBlankEnvAndOverrides.officeAddress,
      "Nizam Pura, Chunian, District Kasur, Punjab, Pakistan",
    );
    assert.equal(fromBlankEnvAndOverrides.website, "www.naturanzafood.com");

    // Explicit BUSINESS_LEGAL_NAME env override is respected alongside storeName
    process.env.BUSINESS_LEGAL_NAME = "Naturanza Foods";
    delete process.env.BUSINESS_BRAND_NAME;
    assert.equal(
      resolveInvoiceCompany({ brandName: "Naturanza Food" }).displayName,
      "Naturanza Food (Naturanza Foods)",
    );

    // Rendered PDF text contains both brand and legal entity plus FBR address when storeName is passed
    const pdfBuffer = await createInvoicePdfBuffer(
      {
        id: 202,
        customer_name: "Compliance Reviewer",
        customer_email: "reviewer@example.com",
        shipping_address: "Plot 10, Gulberg",
        city: "Lahore",
        phone: "+923001112233",
        payment_method: "safepay",
        status: "confirmed",
        subtotal: 2000,
        tax: 0,
        shipping_cost: 250,
        discount_amount: 0,
        total_amount: 2250,
        items: [{ product_name: "Almond Infused Honey 500g", quantity: 1, price: 2000 }],
      },
      {
        company: {
          brandName: "Naturanza Food",
          email: "support@naturanzafood.com",
          phone: "+92340 9502646",
          officeAddress: "Nizam Pura, Chunian, District Kasur, Punjab, Pakistan",
        },
      },
    );

    const extractedText = extractPdfText(pdfBuffer);
    assert.match(extractedText, /Naturanza Food \(Naturanza Foods\)/);
    assert.match(extractedText, /Nizam Pura, Chunian, District Kasur, Punjab, Pakistan/);
  } finally {
    if (prevLegalName === undefined) {
      delete process.env.BUSINESS_LEGAL_NAME;
    } else {
      process.env.BUSINESS_LEGAL_NAME = prevLegalName;
    }
    if (prevBrandName === undefined) {
      delete process.env.BUSINESS_BRAND_NAME;
    } else {
      process.env.BUSINESS_BRAND_NAME = prevBrandName;
    }
  }
});
