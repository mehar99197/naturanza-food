/**
 * DB-free regression tests covering full-stack audit fixes across backend
 * settings, migrations, security middleware, CSRF, IPv6 CIDR matching,
 * product content defaults, exchange-rate fallback, and route safety.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { DEFAULT_ADMIN_SETTINGS } = require("../utils/adminSettings");
const {
  preventParamPollution,
  sanitizeQueryParams,
  validatePassword,
} = require("../middleware/security");
const { csrfMiddleware } = require("../middleware/csrf");
const { parseCidr, ipMatchesCidr } = require("../utils/ipAllowlist");
const { getProductContentDefaults } = require("../utils/productContentDefaults");
const { generateSecurePassword } = require("../utils/adminHelpers");

const backendRoot = path.join(__dirname, "..");
const readSource = (relativePath) =>
  fs.readFileSync(path.join(backendRoot, relativePath), "utf8");

test("adminSettings defaults taxRate to 0 and keeps INSERT column/placeholder counts aligned", () => {
  assert.equal(DEFAULT_ADMIN_SETTINGS.taxRate, 0);

  const source = readSource("utils/adminSettings.js");
  const insertMatch = source.match(
    /INSERT INTO admin_settings\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/,
  );
  assert.ok(insertMatch, "admin_settings INSERT statement must exist");

  const columns = insertMatch[1]
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean);
  const placeholders = insertMatch[2]
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  assert.equal(
    columns.length,
    placeholders.length,
    `Expected INSERT columns (${columns.length}) to match placeholders (${placeholders.length})`,
  );
});

test("newsletter migration and schema compatibility backfill never reactivate unsubscribed records", () => {
  const migrationSql = readSource("schema/migrations/028_newsletter_double_opt_in.sql");
  assert.doesNotMatch(
    migrationSql,
    /SET\s+status\s*=\s*'active'/i,
    "migration 028 must never overwrite subscriber status to active",
  );
  assert.match(
    migrationSql,
    /WHERE\s+status\s+IN\s*\('active',\s*'unsubscribed'\)\s+AND\s+verified_at\s+IS\s+NULL/i,
    "migration 028 should only backfill verified_at without altering status",
  );

  const compatSource = readSource("utils/schemaCompatibility.js");
  assert.doesNotMatch(
    compatSource,
    /UPDATE\s+newsletter_subscribers[\s\S]*?SET\s+status\s*=\s*'active'/i,
    "schemaCompatibility must never overwrite subscriber status to active",
  );
  assert.match(
    compatSource,
    /WHERE\s+status\s+IN\s*\('active',\s*'unsubscribed'\)\s+AND\s+verified_at\s+IS\s+NULL/i,
    "schemaCompatibility should only backfill verified_at without altering status",
  );
});

test("migration 010 preserves explicitly assigned admin_role values", () => {
  const migrationSql = readSource("schema/migrations/010_add_admin_columns.sql");
  const backfillMatch = migrationSql.match(
    /UPDATE\s+users[\s\S]*?SET\s+admin_role\s*=\s*'super_admin'[\s\S]*?;/i,
  );
  assert.ok(backfillMatch, "migration 010 should backfill legacy admins");
  assert.match(
    backfillMatch[0],
    /admin_role\s+IS\s+NULL/i,
    "migration 010 must only backfill rows where admin_role IS NULL",
  );
});

test("preventParamPollution and sanitizeQueryParams work on Express 5 getter-only req.query", () => {
  const proto = {};
  const rawQuery = {
    page: ["1", "2"],
    q: "<script>alert(1)</script>honey",
  };
  Object.defineProperty(proto, "query", {
    get() {
      return rawQuery;
    },
    configurable: true,
    enumerable: true,
  });

  const req = Object.create(proto);
  let nextCalls = 0;

  preventParamPollution(req, {}, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 1);
  assert.equal(req.query.page, "2");

  sanitizeQueryParams(req, {}, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 2);
  assert.ok(!/<script/i.test(req.query.q), "script tag must be stripped from req.query");
  assert.ok(req.query.q.includes("honey"));
});

test("validatePassword enforces length, uppercase, lowercase, number, and special character", () => {
  assert.equal(validatePassword("Abcdefgh1234").isValid, false);
  assert.equal(validatePassword("abcdefgh1234!").isValid, false);
  assert.equal(validatePassword("ABCDEFGH1234!").isValid, false);
  assert.equal(validatePassword("Abcdefghijk!").isValid, false);
  assert.equal(validatePassword("Short1!").isValid, false);
  assert.equal(validatePassword("Abcdefgh1234!").isValid, true);
});

test("CSRF rejects unsafe requests ending in static extensions while allowing RFC 8058 unsubscribe", () => {
  const middleware = csrfMiddleware({ cookieSecure: false, cookieSameSite: "lax" });

  const runMiddleware = (method, reqPath) => {
    let statusCode = null;
    let passedNext = false;
    const req = {
      method,
      path: reqPath,
      cookies: {},
      headers: {},
      get: () => "",
    };
    const res = {
      clearCookie() {},
      cookie() {},
      status(code) {
        statusCode = code;
        return { json() {} };
      },
    };
    middleware(req, res, () => {
      passedNext = true;
    });
    return { statusCode, passedNext };
  };

  assert.equal(runMiddleware("DELETE", "/api/admin/users/5.js").statusCode, 403);
  assert.equal(runMiddleware("POST", "/api/orders/receipt.png").statusCode, 403);
  assert.equal(
    runMiddleware("POST", `/api/newsletter/unsubscribe/${"a".repeat(64)}`).passedNext,
    true,
  );
  assert.equal(runMiddleware("DELETE", `/api/newsletter/unsubscribe/${"a".repeat(64)}`).statusCode, 403);
});

test("ipAllowlist parses and matches IPv6 CIDRs including zone suffixes", () => {
  const parsed = parseCidr("2001:db8::/32");
  assert.ok(parsed);
  assert.equal(parsed.family, 6);
  assert.equal(parsed.prefix, 32);

  assert.equal(parseCidr("2001:db8::/129"), null);
  assert.equal(ipMatchesCidr("2001:db8::1", "2001:db8::/32"), true);
  assert.equal(ipMatchesCidr("2001:db8:abcd::42", "2001:db8::/32"), true);
  assert.equal(ipMatchesCidr("2001:db9::1", "2001:db8::/32"), false);
  assert.equal(ipMatchesCidr("fe80::1%eth0", "fe80::/10"), true);
});

test("productContentDefaults avoids matching non-coconut oils while keeping coconut oil match", () => {
  assert.equal(
    getProductContentDefaults({
      name: "Organic Olive Oil",
      slug: "organic-olive-oil",
      category_name: "Oils",
    }),
    null,
  );

  const coconutMatch = getProductContentDefaults({
    name: "Cold-Pressed Coconut Oil",
    slug: "cold-pressed-coconut-oil",
  });
  assert.ok(coconutMatch);
  assert.match(coconutMatch.description, /coconut oil/i);
});

test("exchangeRates falls back gracefully without throwing when upstream fetch fails", async () => {
  const modulePath = require.resolve("../utils/exchangeRates");
  delete require.cache[modulePath];
  const originalFetch = global.fetch;
  const originalAppId = process.env.OPENEXCHANGE_APP_ID;

  try {
    delete process.env.OPENEXCHANGE_APP_ID;
    global.fetch = async () => {
      throw new Error("Simulated network outage");
    };

    const { getPkrExchangeRates } = require("../utils/exchangeRates");
    const result = await getPkrExchangeRates(["USD", "EUR"]);

    assert.equal(result.base, "PKR");
    assert.equal(result.rates.PKR, 1);
    assert.ok(Number.isFinite(result.rates.USD) && result.rates.USD > 0);
    assert.ok(Number.isFinite(result.rates.EUR) && result.rates.EUR > 0);
  } finally {
    global.fetch = originalFetch;
    if (originalAppId === undefined) {
      delete process.env.OPENEXCHANGE_APP_ID;
    } else {
      process.env.OPENEXCHANGE_APP_ID = originalAppId;
    }
    delete require.cache[modulePath];
  }
});

test("admin, coupons, and announcements routes retain key audit fixes and dead files stay removed", () => {
  const generated = generateSecurePassword();
  assert.equal(validatePassword(generated).isValid, true);

  const adminHelpersSource = readSource("utils/adminHelpers.js");
  assert.match(adminHelpersSource, /crypto\.randomInt/);
  assert.doesNotMatch(adminHelpersSource, /Math\.random/);

  const adminSource = readSource("routes/admin.js");
  assert.match(adminSource, /let userRow = null/);
  assert.match(adminSource, /let userAdminRole = ""/);
  assert.match(adminSource, /admin_failed_login_attempts\s*=\s*0/);
  assert.match(adminSource, /admin_locked_until\s*=\s*NULL/);
  assert.match(adminSource, /confirmedOrders/);
  assert.match(adminSource, /\/newsletter\/welcome-promo/);

  const couponsSource = readSource("routes/coupons.js");
  assert.match(couponsSource, /per_user_limit\s*===\s*undefined/);

  const announcementsSource = readSource("routes/announcements.js");
  assert.match(announcementsSource, /instanceof Date/);

  assert.equal(fs.existsSync(path.join(backendRoot, "src")), false);
  assert.equal(fs.existsSync(path.join(backendRoot, "utils/imageOptimizer.js")), false);
});
