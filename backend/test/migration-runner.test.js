const test = require('node:test');
const assert = require('node:assert/strict');

const {
  discoverMigrations,
  parseArgs,
  resolveOnly,
  splitSqlStatements,
} = require('../run-migration');

test('statement splitter ignores semicolons inside comments and literals', () => {
  const sql = `
    -- a comment; with a semicolon
    CREATE TABLE things (id INT);
    /* block; comment */
    INSERT INTO things (note) VALUES ('a; b');
    INSERT INTO things (note) VALUES ("c; d"); # trailing; comment
    INSERT INTO things (\`weird;name\`) VALUES ('it''s; escaped');
  `;

  const statements = splitSqlStatements(sql);

  assert.equal(statements.length, 4);
  assert.equal(statements[0], 'CREATE TABLE things (id INT)');
  assert.equal(statements[1], "INSERT INTO things (note) VALUES ('a; b')");
  assert.equal(statements[2], 'INSERT INTO things (note) VALUES ("c; d")');
  assert.equal(statements[3], "INSERT INTO things (`weird;name`) VALUES ('it''s; escaped')");
});

test('statement splitter keeps a trailing statement that has no final semicolon', () => {
  assert.deepEqual(splitSqlStatements('SELECT 1'), ['SELECT 1']);
  assert.deepEqual(splitSqlStatements('SELECT 1;\n\n-- done\n'), ['SELECT 1']);
});

test('statement splitter drops empty fragments rather than emitting blank statements', () => {
  assert.deepEqual(splitSqlStatements(';;\n-- only comments\n;'), []);
  assert.deepEqual(splitSqlStatements(''), []);
});

test('every shipped migration splits into non-empty statements', () => {
  const migrations = discoverMigrations();

  assert.ok(migrations.length > 0, 'expected migration files to be discovered');

  for (const migration of migrations) {
    const statements = splitSqlStatements(migration.sql);
    assert.ok(statements.length > 0, `${migration.name} produced no statements`);
    for (const statement of statements) {
      assert.notEqual(statement.trim(), '', `${migration.name} produced a blank statement`);
    }
    assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  }
});

test('every migration is uniquely numbered and discovered in numeric order', () => {
  const names = discoverMigrations().map((migration) => migration.name);

  const numbers = names.map((name) => {
    const match = /^(\d+)_/.exec(name);
    assert.ok(match, `${name} has no numeric prefix`);
    return Number.parseInt(match[1], 10);
  });

  assert.equal(new Set(numbers).size, numbers.length, 'duplicate migration numbers');
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), 'not discovered in numeric order');
  // 9 must not sort after 10 the way a plain string sort would put it.
  assert.ok(names.indexOf('009_remove_admin_2fa.sql') < names.indexOf('010_add_admin_columns.sql'));
});

test('a migration that alters a table runs after the one that creates it', () => {
  const names = discoverMigrations().map((migration) => migration.name);
  const before = (a, b) => assert.ok(names.indexOf(a) < names.indexOf(b), `${a} must precede ${b}`);

  // 029 alters email_verification_codes, which only 026 creates.
  before('026_add_email_verification.sql', '029_bind_verification_credential.sql');
  // 028 alters newsletter_subscribers, which 015 creates.
  before('015_add_newsletter_subscribers.sql', '028_newsletter_double_opt_in.sql');
  // 000 sets the database default charset that every later CREATE TABLE inherits.
  assert.equal(names[0], '000_upgrade_legacy_schema.sql');
});

test('the schema uses exactly one collation, and a portable one', () => {
  const sources = discoverMigrations();
  sources.push({
    name: 'database.sql',
    sql: require('fs').readFileSync(require('path').join(__dirname, '..', 'schema', 'database.sql'), 'utf8'),
  });

  for (const { name, sql } of sources) {
    // Comments legitimately name the old collation to explain the change.
    const code = sql.replace(/^\s*--.*$/gm, '');
    const collations = new Set(code.match(/utf8mb4_[a-z0-9_]+/gi) || []);
    for (const collation of collations) {
      // utf8mb4_0900_ai_ci is MySQL-8-only and does not exist on MariaDB, which is
      // what Hostinger often serves. Mixing collations also breaks JOINs on strings.
      assert.equal(
        collation.toLowerCase(),
        'utf8mb4_unicode_ci',
        `${name} uses ${collation}; the whole schema must stay on utf8mb4_unicode_ci`,
      );
    }
  }
});

test('no migration hardcodes a database name', () => {
  for (const { name, sql } of discoverMigrations()) {
    assert.doesNotMatch(sql, /^\s*USE\s+\w/im, `${name} contains a USE <db> statement`);
    assert.doesNotMatch(
      sql,
      /ALTER\s+DATABASE\s+(?!CHARACTER|COLLATE|DEFAULT)\w/i,
      `${name} names a database in ALTER DATABASE`,
    );
  }
});

test('resolveOnly matches by number or filename and refuses an ambiguous number', () => {
  const migrations = discoverMigrations();

  assert.equal(resolveOnly(migrations, '027').name, '027_add_coupon_per_user_limit.sql');
  assert.equal(
    resolveOnly(migrations, '027_add_coupon_per_user_limit.sql').name,
    '027_add_coupon_per_user_limit.sql',
  );
  assert.throws(() => resolveOnly(migrations, '999'), /No migration matches/);

  // Numbers are unique today; the guard must still fire if a collision comes back.
  const collided = [{ name: '007_a.sql' }, { name: '007_b.sql' }];
  assert.throws(() => resolveOnly(collided, '007'), /matches 2 migrations/);
});

test('argument parsing accepts the documented flags and rejects the rest', () => {
  assert.deepEqual(parseArgs(['--status']).status, true);
  assert.deepEqual(parseArgs(['--dry-run']).dryRun, true);
  assert.deepEqual(parseArgs(['--baseline']).baseline, true);
  assert.equal(parseArgs(['--only', '027']).only, '027');
  assert.equal(parseArgs(['--only=027']).only, '027');
  assert.equal(parseArgs(['--only', '027', '--force']).force, true);

  assert.equal(parseArgs(['--except', '011,027']).except, '011,027');
  assert.equal(parseArgs(['--except=011,027']).except, '011,027');

  assert.throws(() => parseArgs(['--nope']), /Unknown option/);
  assert.throws(() => parseArgs(['--only']), /needs a migration number/);
  assert.throws(() => parseArgs(['--force']), /only applies together with --only/);
  assert.throws(() => parseArgs(['--except']), /needs a comma-separated list/);
  assert.throws(() => parseArgs(['--only', '011', '--except', '027']), /contradict each other/);
});
