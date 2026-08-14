/**
 * Regression tests for the audit findings fixed on 2026-08-14.
 *
 * Every bug in that audit lived in code the suite did not execute. Each test
 * below fails against the pre-fix behaviour, so a revert is caught here rather
 * than in production. Deliberately DB-free — these cover the decision logic,
 * not the queries.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sanitizeInput, sanitizeObject } = require('../middleware/security');
const security = require('../middleware/security');
const { escapeHtml } = require('../utils/htmlEscape');
const { PRIVATE_UPLOAD_FOLDERS, PUBLIC_UPLOAD_FOLDERS } = require('../middleware/upload');

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

// --- H-02: the sanitizer must not rebuild markup it just stripped ------------

test('sanitizer leaves percent-encoded payloads inert', () => {
  // Pre-fix, a trailing decodeURIComponent pass turned each of these back into
  // working markup, because the event-handler pattern needs a literal "=".
  const payloads = [
    '%3Cimg src%3Dx onerror%3Dalert(1)%3E',
    '%3Cscript%3Ealert(1)%3C/script%3E',
    '%3Csvg onload%3Dalert(1)%3E',
    '%3Ca href%3D%22javascript:alert(1)%22%3Ex%3C/a%3E',
  ];

  for (const payload of payloads) {
    const output = sanitizeInput(payload);
    assert.equal(output, payload, 'encoded input must pass through untouched');
    assert.ok(!/<\s*[a-z]/i.test(output), `no tag may be reconstructed from ${payload}`);
  }
});

test('sanitizer still neutralises literal markup', () => {
  assert.ok(!/<\s*[a-z]/i.test(sanitizeInput('<script>alert(1)</script>')));
  assert.ok(!/<\s*[a-z]/i.test(sanitizeInput('<img src=x onerror=alert(1)>')));
});

// --- M-03: ordinary customer text must not be rejected -----------------------

test('the SQL keyword blocklist is gone', () => {
  assert.equal(security.preventSQLInjection, undefined);
  assert.equal(security.isSafeSQLInput, undefined);
});

test('customer text containing SQL-ish punctuation survives', () => {
  // Each of these was a 400 "Invalid input detected" in a contact message,
  // order note or address.
  for (const text of [
    'Deliver 9-5 -- thanks',
    'Call me -- urgent',
    'Buy 2 get 1 -- free',
    'price/*note*/',
  ]) {
    assert.equal(sanitizeInput(text), text);
  }
});

// --- M-06: restrictBody must not be bypassable through the prototype ---------

test('sanitizeObject drops __proto__ instead of assigning through it', () => {
  const body = JSON.parse('{"__proto__":{"role":"admin"},"name":"bob"}');
  const cleaned = sanitizeObject(body);

  assert.deepEqual(Object.keys(cleaned), ['name']);
  assert.equal(cleaned.role, undefined, 'injected value must not be readable');
  assert.equal(Object.prototype.role, undefined, 'global prototype must stay clean');
});

test('restrictBody rejects unexpected own fields', () => {
  const middleware = security.restrictBody('name');
  let status = null;
  middleware(
    { body: { name: 'ok', role: 'admin' } },
    { status: (code) => ({ json: () => { status = code; } }) },
    () => { status = 'next'; },
  );
  assert.equal(status, 400);
});

// --- M-04: values interpolated into email HTML are escaped -------------------

test('escapeHtml neutralises markup and keeps a literal zero', () => {
  assert.equal(escapeHtml('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  assert.equal(escapeHtml(`a"b'c&d`), 'a&quot;b&#39;c&amp;d');
  assert.equal(escapeHtml(0), '0', '`?? ""` not `|| ""` — a zero stock count must render');
  assert.equal(escapeHtml(null), '');
});

test('order email templates escape every customer-supplied value', () => {
  const source = readSource('routes/orders.js');
  for (const pattern of [
    /escapeHtml\(order\?\.customer_name/,
    /escapeHtml\(order\?\.customer_email/,
    /escapeHtml\(event\.product_name\)/,
    /escapeHtml\(order\.shipping_address\)/,
    /escapeHtml\(order\.notes\)/,
    /escapeHtml\(order\.phone\)/,
    /escapeHtml\(item\.name \|\| item\.product_name\)/,
  ]) {
    assert.match(source, pattern);
  }
});

// --- C-01: payment screenshots are not reachable as static files -------------

test('payment-verifications is not in the public static folder list', () => {
  assert.ok(PRIVATE_UPLOAD_FOLDERS.has('payment-verifications'));
  assert.ok(!PUBLIC_UPLOAD_FOLDERS.includes('payment-verifications'));
});

test('the private-upload guard sees through encoded and doubled separators', () => {
  // Exercises the real guard lifted out of index.js: a mount-path prefix match
  // missed "%2f" and "//" while express.static still resolved the file.
  const source = readSource('index.js');
  const body = source.slice(
    source.indexOf('const requestsPrivateUpload'),
    source.indexOf('app.use("/images", (req, res, next) => {'),
  );
  assert.ok(body.length > 100, 'guard source must be locatable');
  const requestsPrivateUpload = new Function(
    'PRIVATE_UPLOAD_FOLDERS',
    `${body}; return requestsPrivateUpload;`,
  )(PRIVATE_UPLOAD_FOLDERS);

  for (const blocked of [
    '/payment-verifications/s.webp',
    '/payment-verifications%2fs.webp',
    '/payment-verifications%252fs.webp',
    '//payment-verifications/s.webp',
    '/./payment-verifications/s.webp',
    '/PAYMENT-VERIFICATIONS/s.webp',
    '/Payment-Verifications%2Fs.webp',
    '/products/../payment-verifications/s.webp',
  ]) {
    assert.equal(requestsPrivateUpload(blocked), true, `must block ${blocked}`);
  }

  for (const allowed of ['/products/honey.webp', '/categories/tea.webp', '/blog/post.webp']) {
    assert.equal(requestsPrivateUpload(allowed), false, `must serve ${allowed}`);
  }
});

// --- C-02: admin permissions cannot be bypassed by URL casing ----------------

test('the admin permission table matches regardless of path casing', () => {
  const source = readSource('routes/admin.js');
  assert.match(
    source,
    /express\.Router\(\{\s*caseSensitive:\s*true\s*\}\)/,
    'routing and the permission table must agree on casing',
  );

  const rules = source.slice(
    source.indexOf('const ADMIN_PERMISSION_RULES'),
    source.indexOf('router.use(requireAdminRoutePermission)'),
  );
  const seen = [];
  const requireAdminRoutePermission = new Function(
    'requirePermission',
    `${rules}; return requireAdminRoutePermission;`,
  )((permission) => (req, res, next) => { seen.push(permission); next(); });

  const evaluate = (reqPath, user) => {
    seen.length = 0;
    let denied = null;
    requireAdminRoutePermission(
      { path: reqPath, user },
      { status: () => ({ json: (payload) => { denied = payload.error; } }) },
      () => seen.push('UNGUARDED'),
    );
    return denied ? 'DENY' : seen[0];
  };

  const staff = { admin_role: 'staff_admin', admin_permissions: [] };
  assert.equal(evaluate('/users', staff), 'manage_customers');
  assert.equal(evaluate('/Users', staff), 'manage_customers');
  assert.equal(evaluate('/USERS/5/status', staff), 'manage_customers');
  assert.equal(evaluate('/Products', staff), 'manage_products');
  assert.equal(evaluate('/RETURNS/3/status', staff), 'manage_returns');
  assert.equal(evaluate('/Settings', staff), 'DENY');
  assert.equal(evaluate('/Tax-Rates/2', staff), 'DENY');

  assert.equal(evaluate('/Settings', { admin_role: 'super_admin' }), 'UNGUARDED');
  assert.equal(evaluate('/dashboard/stats', staff), 'UNGUARDED');
});

// --- M-05: the SEO renderer must not interpret "$" in replacements -----------

test('a dollar sign in a product name cannot break out of a meta tag', () => {
  const source = readSource('utils/seoRenderer.js');
  const escapeAttr = new Function(
    `${source.slice(source.indexOf('const escapeAttr'), source.indexOf('// Every replacement below'))}; return escapeAttr;`,
  )();
  const setMeta = new Function(
    'escapeAttr',
    `${source.slice(source.indexOf('const setMeta'), source.indexOf('const setCanonical'))}; return setMeta;`,
  )(escapeAttr);

  const template = '<head><meta name="description" content="old"><script src="/a.js"></script></head>';
  for (const name of ['Honey $2 Off', 'Sale $&', "Promo $'", 'Deal $`', 'Plain Name']) {
    const rendered = setMeta(template, 'name', 'description', name);
    assert.equal(
      rendered.match(/content="([^"]*)"/)[1],
      escapeAttr(name),
      `"${name}" must be inserted verbatim, not substituted`,
    );
  }
});

// --- M-08: the schema must pin an engine that supports what the code needs ---

test('every table declares InnoDB and utf8mb4', () => {
  const schema = readSource('schema/database.sql');
  const tables = (schema.match(/^CREATE TABLE/gm) || []).length;
  const declared = (schema.match(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g) || []).length;

  assert.ok(tables > 0);
  assert.equal(
    declared,
    tables,
    'transactions, FOR UPDATE and foreign keys are all silently ignored on MyISAM',
  );
});

// --- M-09: no function wrapper on an indexed join column ---------------------

test('order_id joins are not wrapped in CAST', () => {
  for (const file of ['routes/adminPayments.js', 'utils/stockReservations.js']) {
    assert.doesNotMatch(
      readSource(file),
      /CAST\(\s*\w*\.?order_id\s+AS\s+UNSIGNED\s*\)/i,
      `${file} must not defeat the index on order_id`,
    );
  }
});

// --- M-01: pooled connections are released on every path ---------------------

test('login and reset-password release their connection in a finally', () => {
  for (const file of ['routes/auth.js', 'routes/admin.js']) {
    const source = readSource(file);
    assert.match(source, /connectionReleased/, `${file} must use the idempotent release guard`);
    assert.match(source, /\}\s*finally\s*\{\s*(\/\/[^\n]*\n\s*)*releaseConnection\(\);/,
      `${file} must release in a finally`);
  }
});

// --- M-02: CSRF has no path-only exemptions ----------------------------------

test('no CSRF path exclusions remain', () => {
  assert.doesNotMatch(readSource('middleware/csrf.js'), /excludePaths|excludedPaths/);
  assert.doesNotMatch(readSource('index.js'), /excludePaths/);
});
