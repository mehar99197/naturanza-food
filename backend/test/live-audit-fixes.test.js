/**
 * DB-free regression tests for all live-audit fixes:
 * - Search modal Popular Searches derived dynamically from active products (no stale Herbal Oil / Green Tea).
 * - Orphaned reserved_stock reconciliation preserving active holds and taking zero locks in steady state.
 * - Store-wide 0% discount guard across adminSettings, ProductDetail mobile banner, and AdminSettings validation.
 * - About Us content & defaults alignment (no "Since 2010" / "over a decade", 3+ years & 5+ organic products).
 * - SEO & Google Merchant feed (robots.txt allows /api/merchant-feed.xml, store-wide discount applied in feed,
 *   Categories.jsx & Shop.jsx link to clean /shop/<slug> URLs).
 * - Guest console 401 elimination (session hint cookie + shouldAttemptSilentRefresh).
 * - Google GSI singleton initialization (initialize() called at most once across mobile resize & route transitions).
 * - Social metadata alignment (Facebook, Instagram, TikTok — no unused Twitter handle or stale URLs).
 * - Migration 034 idempotency and safety.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.JWT_SECRET ||= "x".repeat(64);

const backendRoot = path.join(__dirname, "..");
const frontendRoot = path.join(backendRoot, "..", "frontend");

const readFrontend = (relPath) =>
  fs.readFileSync(path.join(frontendRoot, relPath), "utf8");
const readBackend = (relPath) =>
  fs.readFileSync(path.join(backendRoot, relPath), "utf8");
const importFrontendModule = (relPath) =>
  import(pathToFileURL(path.join(frontendRoot, relPath)).href);

// ---------------------------------------------------------------------------
// 1. Search Modal Popular Searches (Screenshot Issue)
// ---------------------------------------------------------------------------
test("buildPopularSearchTerms derives live catalog search terms and excludes non-existent items", async () => {
  const {
    DEFAULT_POPULAR_SEARCHES,
    buildPopularSearchTerms,
    extractCleanProductSearchTerm,
  } = await importFrontendModule("src/lib/searchSuggestions.js");

  const liveProducts = [
    {
      id: 10,
      name: "Turmeric (Pure Organic Haldi) 200g",
      category_name: "Spices",
      description: "100% pure organic turmeric (haldi) powder.",
      is_active: 1,
      deleted_at: null,
    },
    {
      id: 9,
      name: "Red Chili (Lal Mirch) 200g",
      category_name: "Spices",
      description: "100% pure, sun-dried red chili powder.",
      is_active: 1,
      deleted_at: null,
    },
    {
      id: 5,
      name: "Almond Infused Honey 500g",
      category_name: "Honey",
      description: "Pure natural honey from mountain farms.",
      is_active: 1,
      deleted_at: null,
    },
    {
      id: 4,
      name: "Sandal Infused Honey 500g",
      category_name: "Honey",
      description: "Pure natural honey from mountain farms.",
      is_active: 1,
      deleted_at: null,
    },
    {
      id: 3,
      name: "Ispaghol Husk 80g",
      category_name: "Ispaghol",
      description: "Natural ispaghol husk fiber.",
      is_active: 1,
      deleted_at: null,
    },
    // Inactive / deleted products must never pollute Popular Searches
    {
      id: 99,
      name: "Organic Green Tea 100g",
      category_name: "Herbal Teas",
      description: "Discontinued tea",
      is_active: 0,
      deleted_at: null,
    },
    {
      id: 100,
      name: "Herbal Oil 250ml",
      category_name: "Oils",
      description: "Deleted oil",
      is_active: 1,
      deleted_at: "2026-08-01T00:00:00.000Z",
    },
  ];

  const terms = buildPopularSearchTerms(liveProducts, { limit: 5 });
  assert.deepEqual(terms, ["Honey", "Ispaghol", "Spices", "Turmeric", "Red Chili"]);
  assert.ok(!terms.some((t) => /herbal oil|green tea/i.test(t)));

  // Every returned term must match at least one active product under Shop.jsx's search logic
  const activeOnly = liveProducts.filter((p) => p.is_active === 1 && !p.deleted_at);
  for (const term of terms) {
    const q = term.toLowerCase();
    const matched = activeOnly.some(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
    assert.equal(matched, true, `Popular search term "${term}" must match an active product`);
  }

  // Empty/null catalog falls back cleanly to catalog-accurate defaults
  assert.deepEqual(buildPopularSearchTerms([]), DEFAULT_POPULAR_SEARCHES);
  assert.deepEqual(buildPopularSearchTerms(null), DEFAULT_POPULAR_SEARCHES);
  assert.ok(!DEFAULT_POPULAR_SEARCHES.some((t) => /herbal oil|green tea/i.test(t)));

  // Single-category catalog backfills with distinct product base names without inventing fake tags
  const honeyOnly = buildPopularSearchTerms(
    [
      { id: 4, name: "Sandal Infused Honey 500g", category_name: "Honey", is_active: 1 },
      { id: 5, name: "Almond Infused Honey 500g", category_name: "Honey", is_active: 1 },
    ],
    { limit: 5 },
  );
  assert.deepEqual(honeyOnly, ["Honey", "Sandal Infused Honey", "Almond Infused Honey"]);

  // Edge cases in extractCleanProductSearchTerm
  assert.equal(extractCleanProductSearchTerm("Turmeric (Pure Organic Haldi) 200g"), "Turmeric");
  assert.equal(extractCleanProductSearchTerm("(500g)"), "(500g)");
  assert.equal(extractCleanProductSearchTerm("   "), "");

  // Navigation.jsx uses buildPopularSearchTerms and has no hardcoded Herbal Oil / Green Tea
  const navSource = readFrontend("src/components/Navigation.jsx");
  assert.match(navSource, /buildPopularSearchTerms/);
  assert.doesNotMatch(navSource, /Herbal Oil|Green Tea/);
});

// ---------------------------------------------------------------------------
// 2. Orphaned reserved_stock reconciliation (Issue #3)
// ---------------------------------------------------------------------------
test("reconcileOrphanedReservedStock clears orphaned holds, preserves active holds, and avoids locks when clean", async () => {
  const { reconcileOrphanedReservedStock } = require("../utils/stockReservations");

  // Case A: steady state — zero drift, must NOT acquire a pooled connection
  let connectionRequests = 0;
  const cleanPool = {
    query: async () => [[]],
    getConnection: async () => {
      connectionRequests += 1;
      throw new Error("Should not request connection when no drift exists");
    },
  };
  const cleanResult = await reconcileOrphanedReservedStock(cleanPool);
  assert.deepEqual(cleanResult, { reconciledCount: 0, releasedUnits: 0, products: [] });
  assert.equal(connectionRequests, 0);

  // Case B: production scenario — ids 3 (1), 4 (16), 5 (60) orphaned, plus id 6 with 10 reserved & 3 truly held
  const updates = [];
  let committed = false;
  let released = false;
  const driftedPool = {
    query: async () => [
      [
        { id: 3, reserved_stock: 1, expected_reserved: 0 },
        { id: 4, reserved_stock: 16, expected_reserved: 0 },
        { id: 5, reserved_stock: 60, expected_reserved: 0 },
        { id: 6, reserved_stock: 10, expected_reserved: 3 },
      ],
    ],
    getConnection: async () => ({
      beginTransaction: async () => {},
      query: async (sql, params) => {
        if (/SELECT id, reserved_stock/i.test(sql)) {
          assert.deepEqual(params[0], [3, 4, 5, 6]);
          return [
            [
              { id: 3, reserved_stock: 1 },
              { id: 4, reserved_stock: 16 },
              { id: 5, reserved_stock: 60 },
              { id: 6, reserved_stock: 10 },
            ],
          ];
        }
        if (/FROM stock_reservations/i.test(sql)) {
          return [[{ product_id: 6, held_qty: 3 }]];
        }
        if (/UPDATE products SET reserved_stock/i.test(sql)) {
          updates.push({ nextReserved: params[0], productId: params[1] });
          return [{ affectedRows: 1 }];
        }
        return [[]];
      },
      commit: async () => {
        committed = true;
      },
      rollback: async () => {},
      release: () => {
        released = true;
      },
    }),
  };

  const result = await reconcileOrphanedReservedStock(driftedPool);
  assert.equal(committed, true);
  assert.equal(released, true);
  assert.equal(result.reconciledCount, 4);
  assert.equal(result.releasedUnits, 1 + 16 + 60 + 7);
  assert.deepEqual(updates, [
    { productId: 3, nextReserved: 0 },
    { productId: 4, nextReserved: 0 },
    { productId: 5, nextReserved: 0 },
    { productId: 6, nextReserved: 3 },
  ]);

  // Standalone consume/release helpers also guard against negative underflow
  const stockResvSource = readBackend("utils/stockReservations.js");
  assert.doesNotMatch(stockResvSource, /SET reserved_stock = reserved_stock - \?/);
});

// ---------------------------------------------------------------------------
// 3. Store-wide 0% discount guard & tax_rate alignment (Issue #4)
// ---------------------------------------------------------------------------
test("store-wide sale cannot appear active when percentage is 0% across backend settings, ProductDetail, and AdminSettings", async () => {
  const { toPublicSettings, updateAdminSettings } = require("../utils/adminSettings");

  // Public settings never report storeDiscountActive=true when percentage <= 0
  const zeroPctPublic = toPublicSettings({
    storeName: "Naturanza Food",
    storeEmail: "support@naturanzafood.com",
    currency: "PKR",
    taxRate: 0,
    shippingFlat: 250,
    shippingFree: 5000,
    storeDiscountActive: true,
    storeDiscountPercentage: 0,
    storeDiscountLabel: "Store Sale",
  });
  assert.equal(zeroPctPublic.storeDiscountActive, false);

  const positivePctPublic = toPublicSettings({
    storeName: "Naturanza Food",
    storeEmail: "support@naturanzafood.com",
    currency: "PKR",
    taxRate: 0,
    shippingFlat: 250,
    shippingFree: 5000,
    storeDiscountActive: true,
    storeDiscountPercentage: 15,
    storeDiscountLabel: "Eid Sale",
  });
  assert.equal(positivePctPublic.storeDiscountActive, true);
  assert.equal(positivePctPublic.storeDiscountPercentage, 15);

  // updateAdminSettings auto-disables storeDiscountActive when percentage <= 0
  let persistedActive = null;
  const fakeDb = {
    query: async (sql, params) => {
      if (/^SELECT \* FROM admin_settings/i.test(sql.trim())) {
        return [[{ id: 1, store_discount_active: 0, store_discount_percentage: 0 }]];
      }
      if (/^UPDATE admin_settings/i.test(sql.trim())) {
        persistedActive = params[24]; // store_discount_active parameter
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
  };
  const updated = await updateAdminSettings(fakeDb, {
    storeDiscountActive: true,
    storeDiscountPercentage: 0,
  });
  assert.equal(updated.storeDiscountActive, false);
  assert.equal(persistedActive, false);

  // ProductDetail mobile view guards the Store Sale banner with storeDiscountPercentage > 0
  const productDetailSource = readFrontend("src/pages/ProductDetail.jsx");
  assert.match(
    productDetailSource,
    /const isStoreSaleActive\s*=\s*Boolean\(settings\.storeDiscountActive\)\s*&&\s*\(Number\(settings\.storeDiscountPercentage\)\s*\|\|\s*0\)\s*>\s*0/,
  );
  assert.match(productDetailSource, /\{hasDiscount && isStoreSaleActive \?/);
  assert.doesNotMatch(productDetailSource, /\{hasDiscount && settings\.storeDiscountActive \?/);

  // AdminSettings validates storeDiscountPercentage > 0 when activating sale
  const adminSettingsSource = readFrontend("src/pages/AdminSettings.jsx");
  assert.match(adminSettingsSource, /Discount must be greater than 0% while sale is active/);

  // schemaCompatibility defaults admin_settings.tax_rate to 0.00 (not 18.00)
  const compatSource = readBackend("utils/schemaCompatibility.js");
  assert.doesNotMatch(compatSource, /tax_rate DECIMAL\(5, 2\) DEFAULT 18\.00/);
  assert.match(compatSource, /tax_rate DECIMAL\(5, 2\) DEFAULT 0\.00/);
});

// ---------------------------------------------------------------------------
// 4. About Us copy & stats consistency (Issue #5)
// ---------------------------------------------------------------------------
test("About Us defaults, homepage About section, and AboutSEO remove contradictory 'Since 2010' / 'over a decade' claims", () => {
  const { DEFAULT_ABOUT_CONTENT } = require("../utils/aboutContent");

  assert.doesNotMatch(DEFAULT_ABOUT_CONTENT.hero.subtitle, /2010|decade/i);
  const yearsStat = DEFAULT_ABOUT_CONTENT.stats.find((s) => /Years Experience/i.test(s.label));
  const productsStat = DEFAULT_ABOUT_CONTENT.stats.find((s) => /Organic Products/i.test(s.label));
  assert.equal(yearsStat?.value, 3);
  assert.equal(productsStat?.value, 5);

  const aboutPageSource = readFrontend("src/pages/About.jsx");
  assert.doesNotMatch(aboutPageSource, /Since 2010/i);
  assert.match(aboutPageSource, /value:\s*3,\s*suffix:\s*'\+',\s*label:\s*'Years Experience'/);
  assert.match(aboutPageSource, /value:\s*5,\s*suffix:\s*'\+',\s*label:\s*'Organic Products'/);

  const aboutSectionSource = readFrontend("src/sections/About.jsx");
  assert.doesNotMatch(aboutSectionSource, /over a decade|Since 2010/i);

  const seoSource = readFrontend("src/components/SEO.jsx");
  assert.doesNotMatch(seoSource, /Since 2010/i);
});

// ---------------------------------------------------------------------------
// 5. SEO & Google Merchant Feed (Issue #6)
// ---------------------------------------------------------------------------
test("robots.txt allows /api/merchant-feed.xml, merchantFeed applies active store-wide discounts, and category links use /shop/<slug>", async () => {
  // 5a: robots.txt permits /api/merchant-feed.xml before Disallow: /api/
  const robotsTxt = readFrontend("public/robots.txt");
  const allowIdx = robotsTxt.indexOf("Allow: /api/merchant-feed.xml");
  const disallowIdx = robotsTxt.indexOf("Disallow: /api/");
  assert.ok(allowIdx !== -1, "robots.txt must include Allow: /api/merchant-feed.xml");
  assert.ok(disallowIdx !== -1 && allowIdx < disallowIdx, "Allow must precede Disallow: /api/");

  // 5b: merchantFeed applies Math.max(perProductPct, storeDiscountPct)
  const merchantFeed = require("../routes/merchantFeed");
  const baseProduct = {
    id: 10,
    name: "Turmeric (Pure Organic Haldi) 200g",
    description: "Pure organic turmeric powder.",
    image_url: "/images/products/haldi.webp",
    price: "420.00",
    discount_percentage: "0.00",
    stock_quantity: 50,
    reserved_stock: 0,
    barcode: "0784300968481",
  };
  const discountedProduct = {
    ...baseProduct,
    id: 5,
    name: "Almond Infused Honey 500g",
    price: "2500.00",
    discount_percentage: "20.00",
  };

  // No store-wide sale
  assert.match(merchantFeed.buildItemXml(baseProduct, 0), /<g:price>420\.00 PKR<\/g:price>/);
  assert.match(merchantFeed.buildItemXml(discountedProduct, 0), /<g:price>2000\.00 PKR<\/g:price>/);

  // 15% store-wide sale discounts 0% product, but preserves deeper 20% product discount
  assert.match(merchantFeed.buildItemXml(baseProduct, 15), /<g:price>357\.00 PKR<\/g:price>/);
  assert.match(merchantFeed.buildItemXml(discountedProduct, 15), /<g:price>2000\.00 PKR<\/g:price>/);

  // 25% store-wide sale overrides 20% product discount
  assert.match(merchantFeed.buildItemXml(discountedProduct, 25), /<g:price>1875\.00 PKR<\/g:price>/);

  // fetchActiveStoreDiscountPct returns 0 when inactive, clamps when active, and fails safe on DB error
  assert.equal(
    await merchantFeed.fetchActiveStoreDiscountPct({
      query: async () => [[{ store_discount_active: 0, store_discount_percentage: 25 }]],
    }),
    0,
  );
  assert.equal(
    await merchantFeed.fetchActiveStoreDiscountPct({
      query: async () => [[{ store_discount_active: 1, store_discount_percentage: 15 }]],
    }),
    15,
  );
  assert.equal(
    await merchantFeed.fetchActiveStoreDiscountPct({
      query: async () => [[{ store_discount_active: 1, store_discount_percentage: 99 }]],
    }),
    90,
  );
  assert.equal(
    await merchantFeed.fetchActiveStoreDiscountPct({
      query: async () => {
        throw new Error("DB unavailable");
      },
    }),
    0,
  );

  // 5c: Categories.jsx uses clean /shop/<slug> URLs and never /shop?category=
  const categoriesSource = readFrontend("src/sections/Categories.jsx");
  assert.doesNotMatch(categoriesSource, /\/shop\?category=/);
  assert.match(categoriesSource, /\/shop\/\$\{encodeURIComponent\(/);

  // Shop.jsx navigates to clean /shop/<slug> URLs and passes resolved slug to ShopSEO
  const shopSource = readFrontend("src/pages/Shop.jsx");
  assert.match(shopSource, /<ShopSEO category=\{selectedCategorySlug\}/);
  assert.match(shopSource, /\/shop\/\$\{encodeURIComponent\(slug\)\}/);
});

// ---------------------------------------------------------------------------
// 6. Guest Console 401 Noise Elimination (Issue #7)
// ---------------------------------------------------------------------------
test("session hint cookie and shouldAttemptSilentRefresh eliminate guest /api/auth/refresh 401 calls while preserving logged-in sessions", async () => {
  const {
    SESSION_HINT_COOKIE_NAME,
    hasSessionHintCookie,
    shouldAttemptSilentRefresh,
  } = await importFrontendModule("src/lib/authSessionHint.js");

  assert.equal(SESSION_HINT_COOKIE_NAME, "naturanza_session");

  // Exact cookie matching (no prefix/substring false positives)
  assert.equal(hasSessionHintCookie(""), false);
  assert.equal(hasSessionHintCookie("other=1; fake_naturanza_session=1"), false);
  assert.equal(hasSessionHintCookie("naturanza_session=0"), false);
  assert.equal(hasSessionHintCookie("naturanza_session=10"), false);
  assert.equal(hasSessionHintCookie("foo=bar; naturanza_session=1; baz=qux"), true);

  // Guest visitor with neither cached userData nor session hint skips /auth/refresh
  assert.equal(
    shouldAttemptSilentRefresh({
      hasAccessToken: false,
      hasActiveSession: false,
      cachedUser: null,
      cookieString: "",
    }),
    false,
  );

  // Existing logged-in user (localStorage cachedUser before hint cookie rollout) still refreshes
  assert.equal(
    shouldAttemptSilentRefresh({
      hasAccessToken: false,
      hasActiveSession: false,
      cachedUser: { id: 7, email: "user@example.com" },
      cookieString: "",
    }),
    true,
  );

  // Logged-in user across tabs/subdomains with hint cookie (even without localStorage) still refreshes
  assert.equal(
    shouldAttemptSilentRefresh({
      hasAccessToken: false,
      hasActiveSession: false,
      cachedUser: null,
      cookieString: "naturanza_session=1",
    }),
    true,
  );

  // Already has active memory access token -> no refresh needed
  assert.equal(
    shouldAttemptSilentRefresh({
      hasAccessToken: true,
      hasActiveSession: true,
      cachedUser: { id: 7 },
      cookieString: "naturanza_session=1",
    }),
    false,
  );

  // Backend jwtTokens sets & clears BOTH HttpOnly refreshToken and non-HttpOnly naturanza_session cookies
  const jwtTokens = require("../utils/jwtTokens");
  assert.equal(jwtTokens.SESSION_HINT_COOKIE_NAME, "naturanza_session");

  const setCookies = [];
  const clearedCookies = [];
  const mockRes = {
    cookie: (name, value, opts) => setCookies.push({ name, value, opts }),
    clearCookie: (name, opts) => clearedCookies.push({ name, opts }),
  };
  const mockReq = { hostname: "naturanzafood.com", headers: { host: "naturanzafood.com" } };

  jwtTokens.setRefreshSessionCookies(mockRes, mockReq, "jwt-refresh-value");
  const refreshCookieCall = setCookies.find((c) => c.name === jwtTokens.REFRESH_COOKIE_NAME);
  const hintCookieCall = setCookies.find((c) => c.name === jwtTokens.SESSION_HINT_COOKIE_NAME);
  assert.ok(refreshCookieCall, "refreshToken cookie must be set");
  assert.equal(refreshCookieCall.opts.httpOnly, true);
  assert.ok(hintCookieCall, "session hint cookie must be set");
  assert.equal(hintCookieCall.value, "1");
  assert.equal(hintCookieCall.opts.httpOnly, false);

  clearedCookies.length = 0;
  jwtTokens.clearRefreshCookie(mockRes, mockReq);
  assert.ok(clearedCookies.some((c) => c.name === jwtTokens.REFRESH_COOKIE_NAME));
  assert.ok(clearedCookies.some((c) => c.name === jwtTokens.SESSION_HINT_COOKIE_NAME));

  // AuthContext uses shouldAttemptSilentRefresh before calling userAPI.refreshToken()
  const authContextSource = readFrontend("src/context/AuthContext.jsx");
  assert.match(authContextSource, /shouldAttemptSilentRefresh/);
});

// ---------------------------------------------------------------------------
// 7. Mobile Google GSI Multiple-Initialize Fix (Issue #8)
// ---------------------------------------------------------------------------
test("Google GSI coordinator calls initialize() at most once and dispatches callbacks to active screen", async () => {
  const {
    ensureGoogleIdentityInitialized,
    registerGoogleIdentityHandlers,
    unregisterGoogleIdentityHandlers,
    resetGoogleIdentityState,
  } = await importFrontendModule("src/lib/googleIdentity.js");

  resetGoogleIdentityState();

  let initCalls = 0;
  let capturedCallback = null;
  const mockGsiApi = {
    initialize: (config) => {
      initCalls += 1;
      capturedCallback = config.callback;
    },
  };

  // First mount (e.g. /login) initializes once
  const loginReceived = [];
  const loginHandlers = {
    onSuccess: (res) => loginReceived.push(res.credential),
    onError: () => loginReceived.push("error"),
  };
  registerGoogleIdentityHandlers(loginHandlers);
  assert.equal(ensureGoogleIdentityInitialized(mockGsiApi, "client-123"), true);
  assert.equal(initCalls, 1);

  // Width resize on mobile or re-render must NOT call initialize() again
  assert.equal(ensureGoogleIdentityInitialized(mockGsiApi, "client-123"), false);
  assert.equal(initCalls, 1);

  // Navigating /login -> /register reuses existing initialization and routes to Register callbacks
  unregisterGoogleIdentityHandlers(loginHandlers);
  const registerReceived = [];
  const registerHandlers = {
    onSuccess: (res) => registerReceived.push(res.credential),
    onError: () => registerReceived.push("error"),
  };
  registerGoogleIdentityHandlers(registerHandlers);
  assert.equal(ensureGoogleIdentityInitialized(mockGsiApi, "client-123"), false);
  assert.equal(initCalls, 1);

  // Triggering Google callback delivers token to Register (not Login)
  capturedCallback({ credential: "id-token-abc", clientId: "client-123", select_by: "btn" });
  assert.deepEqual(loginReceived, []);
  assert.deepEqual(registerReceived, ["id-token-abc"]);

  // Missing credential triggers onError
  capturedCallback({});
  assert.deepEqual(registerReceived, ["id-token-abc", "error"]);

  resetGoogleIdentityState();

  // AuthSocialButtons uses ensureGoogleIdentityInitialized and waits for host width before rendering
  const socialButtonsSource = readFrontend("src/components/auth/AuthSocialButtons.jsx");
  assert.match(socialButtonsSource, /ensureGoogleIdentityInitialized/);
  assert.match(socialButtonsSource, /isWidthReady/);
  assert.doesNotMatch(socialButtonsSource, /<GoogleLogin\b/);
});

// ---------------------------------------------------------------------------
// 8. Social Metadata Alignment (Issue #9)
// ---------------------------------------------------------------------------
test("social metadata aligns with active Facebook, Instagram, and TikTok profiles with no unused Twitter links", async () => {
  const {
    cleanSocialUrl,
    getConfiguredSocialUrls,
    extractTwitterHandle,
  } = await importFrontendModule("src/lib/socialLinks.js");

  // Strips share-tracking query params while keeping functional params (like FB profile id)
  assert.equal(
    cleanSocialUrl("https://www.instagram.com/naturanzafood?igsh=MWE0MGozeWtueGd2Mw=="),
    "https://www.instagram.com/naturanzafood",
  );
  assert.equal(
    cleanSocialUrl("https://www.tiktok.com/@naturanza.food?_r=1&_t=ZS-98uaMwIhI3A"),
    "https://www.tiktok.com/@naturanza.food",
  );
  assert.equal(
    cleanSocialUrl("https://www.facebook.com/share/18x8ZMDq2H/"),
    "https://www.facebook.com/share/18x8ZMDq2H/",
  );
  assert.equal(
    cleanSocialUrl("https://www.facebook.com/profile.php?id=12345&utm_source=ig"),
    "https://www.facebook.com/profile.php?id=12345",
  );
  assert.equal(cleanSocialUrl("javascript:alert(1)"), null);

  // Configured live settings produce Facebook, Instagram, TikTok (no Twitter)
  const configured = getConfiguredSocialUrls(
    {
      facebookUrl: "https://www.facebook.com/share/18x8ZMDq2H/",
      instagramUrl: "https://www.instagram.com/naturanzafood?igsh=MWE0MGozeWtueGd2Mw==",
      tiktokUrl: "https://www.tiktok.com/@naturanza.food?_r=1&_t=ZS-98uaMwIhI3A",
      twitterUrl: "",
      youtubeUrl: "",
      whatsappNumber: "+92340 9502646",
      whatsappEnabled: true,
    },
    { includeWhatsapp: true },
  );
  assert.deepEqual(configured, [
    "https://www.facebook.com/share/18x8ZMDq2H/",
    "https://www.instagram.com/naturanzafood",
    "https://www.tiktok.com/@naturanza.food",
    "https://wa.me/923409502646",
  ]);

  // Empty settings fall back to real Facebook/Instagram/TikTok (never Twitter)
  const fallback = getConfiguredSocialUrls({});
  assert.equal(fallback.length, 3);
  assert.ok(!fallback.some((u) => /twitter\.com|facebook\.com\/naturanzafood/i.test(u)));

  // Twitter handle extracted ONLY when twitterUrl is configured
  assert.equal(extractTwitterHandle(""), null);
  assert.equal(extractTwitterHandle("https://instagram.com/naturanzafood"), null);
  assert.equal(extractTwitterHandle("https://x.com/naturanzafood"), "@naturanzafood");

  // Static index.html, SEO.jsx, and StructuredData.jsx have zero hardcoded twitter.com / twitter:site handle / stale FB URLs
  const indexHtml = readFrontend("index.html");
  assert.doesNotMatch(indexHtml, /twitter\.com\/naturanzafood/i);
  assert.doesNotMatch(indexHtml, /twitter:(?:site|creator)/i);
  assert.doesNotMatch(indexHtml, /content="@naturanzafood"/i);
  assert.doesNotMatch(indexHtml, /facebook\.com\/naturanzafood/i);
  assert.match(indexHtml, /https:\/\/www\.facebook\.com\/share\/18x8ZMDq2H\//);
  assert.match(indexHtml, /https:\/\/www\.instagram\.com\/naturanzafood/);
  assert.match(indexHtml, /https:\/\/www\.tiktok\.com\/@naturanza\.food/);

  // Per-route canonical/hreflang tags carry data-rh="true" so react-helmet-async replaces rather than duplicates them
  assert.match(indexHtml, /<link\s+rel="canonical"\s+href="https:\/\/naturanzafood\.com\/"\s+data-rh="true"\s*\/>/);
  assert.match(indexHtml, /<link\s+rel="alternate"\s+hreflang="en-pk"\s+href="https:\/\/naturanzafood\.com\/"\s+data-rh="true"\s*\/>/);
  assert.doesNotMatch(indexHtml, /herbal teas|green tea|detox tea|cold pressed oil/i);

  const seoSource = readFrontend("src/components/SEO.jsx");
  assert.doesNotMatch(seoSource, /facebook\.com\/naturanzafood/i);
  assert.doesNotMatch(seoSource, /content="@naturanzafood"/i);
  assert.match(seoSource, /getConfiguredSocialUrls/);

  const structuredDataSource = readFrontend("src/components/StructuredData.jsx");
  assert.doesNotMatch(structuredDataSource, /twitter\.com\/naturanzafood/i);
  assert.doesNotMatch(structuredDataSource, /facebook\.com\/naturanzafood/i);
  assert.doesNotMatch(structuredDataSource, /"description":[^"\n]*herbal teas/i);
  assert.match(structuredDataSource, /getConfiguredSocialUrls/);

  const manifestJson = readFrontend("public/manifest.json");
  assert.doesNotMatch(manifestJson, /herbal teas/i);

  const seoRendererSource = readBackend("utils/seoRenderer.js");
  assert.doesNotMatch(seoRendererSource, /herbal teas/i);
});

// ---------------------------------------------------------------------------
// 9. Migration 034 verification
// ---------------------------------------------------------------------------
test("migration 034 safely reconciles reserved_stock, admin_settings, and about_content", () => {
  const migrationSql = readBackend(
    "schema/migrations/034_reconcile_store_data_and_reserved_stock.sql",
  );
  assert.match(migrationSql, /UPDATE products p[\s\S]*stock_reservations[\s\S]*state = 'held'/i);
  assert.match(migrationSql, /COALESCE\(p\.reserved_stock,\s*0\)\s*<>\s*COALESCE\(sr\.held_qty,\s*0\)/i);
  assert.match(migrationSql, /SET store_discount_active = FALSE/i);
  assert.match(migrationSql, /SET tax_rate = 0\.00/i);
  assert.match(migrationSql, /UPDATE about_content[\s\S]*JSON_SET[\s\S]*\$\.hero\.subtitle[\s\S]*Since 2010/i);
  assert.match(migrationSql, /JSON_SEARCH\(content,\s*'one',\s*'Organic Products'/i);
});

// ---------------------------------------------------------------------------
// 10. Deeper audit fixes: Shop no-remount key, unconditional reservation release
//     on order delete, cookie clearing on account delete & password reset, and
//     GSI handler stack + fresh API re-init
// ---------------------------------------------------------------------------
test("hardened fixes prevent Shop remounts, order-delete stock leaks, stale auth cookies, and GSI handler clobbering", async () => {
  // App.jsx keeps a stable route key across /shop and /shop/:category so category switches never remount Shop
  const appSource = readFrontend("src/App.jsx");
  assert.match(appSource, /isShopRoute\s*\?\s*"\/shop"/);
  assert.match(appSource, /path="\/shop\/:category\?"/);

  const shopSource = readFrontend("src/pages/Shop.jsx");
  assert.match(shopSource, /const handleCategoryChange[\s\S]*?setMobileDrawerOpen\(false\)/);

  // orders.js releases any held reservations unconditionally before DELETE FROM orders
  const ordersSource = readBackend("routes/orders.js");
  assert.match(
    ordersSource,
    /await releaseReservationsOnConnection\(connection,\s*orderId\);\s*\n\s*if \(shouldRestoreStock\)/,
  );

  // Account deletion and password reset clear refresh + session hint cookies
  const profileSecSource = readBackend("controllers/profileSecurityController.js");
  assert.match(profileSecSource, /clearRefreshCookie\(res,\s*req\)/);

  const authRoutesSource = readBackend("routes/auth.js");
  assert.match(
    authRoutesSource,
    /revokeRefreshTokensByUserId\([\s\S]*?"password_reset"[\s\S]*?\);\s*\n\s*clearRefreshCookie\(res,\s*req\)/,
  );

  const authContextSource = readFrontend("src/context/AuthContext.jsx");
  assert.match(authContextSource, /clearSessionHintCookie\(\)/);

  // GSI handler stack preserves previous screen's handlers when an overlapping mount unregisters
  const {
    ensureGoogleIdentityInitialized,
    registerGoogleIdentityHandlers,
    unregisterGoogleIdentityHandlers,
    resetGoogleIdentityState,
  } = await importFrontendModule("src/lib/googleIdentity.js");

  resetGoogleIdentityState();
  let capturedCallback = null;
  const gsiApiA = {
    initialize: (cfg) => {
      capturedCallback = cfg.callback;
    },
  };
  const gsiApiB = {
    initialize: (cfg) => {
      capturedCallback = cfg.callback;
    },
  };

  const logA = [];
  const logB = [];
  const hA = { onSuccess: (r) => logA.push(r.credential), onError: () => logA.push("err") };
  const hB = { onSuccess: (r) => logB.push(r.credential), onError: () => logB.push("err") };

  registerGoogleIdentityHandlers(hA);
  registerGoogleIdentityHandlers(hB);
  assert.equal(ensureGoogleIdentityInitialized(gsiApiA, "cid"), true);
  assert.equal(ensureGoogleIdentityInitialized(gsiApiA, "cid"), false);
  // Unregistering top handler B falls back to still-mounted handler A
  unregisterGoogleIdentityHandlers(hB);
  capturedCallback({ credential: "tok-a" });
  assert.deepEqual(logA, ["tok-a"]);
  assert.deepEqual(logB, []);
  // Fresh GSI API object (e.g., script reload) initializes cleanly
  assert.equal(ensureGoogleIdentityInitialized(gsiApiB, "cid"), true);
  resetGoogleIdentityState();

  // merchantFeed handles string "0" store_discount_active safely and uses fallback description
  const merchantFeed = require("../routes/merchantFeed");
  assert.equal(
    await merchantFeed.fetchActiveStoreDiscountPct({
      query: async () => [[{ store_discount_active: "0", store_discount_percentage: 25 }]],
    }),
    0,
  );
  const xmlWithFallbackDesc = merchantFeed.buildItemXml(
    {
      id: 10,
      name: "Turmeric (Pure Organic Haldi) 200g",
      description: "",
      image_url: "/images/products/haldi.webp",
      price: "420.00",
      discount_percentage: "0.00",
      stock_quantity: 10,
      reserved_stock: 0,
      barcode: "0784300968481",
    },
    0,
  );
  assert.match(xmlWithFallbackDesc, /<description>[^<]*turmeric/i);
});
