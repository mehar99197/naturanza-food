#!/usr/bin/env node
/**
 * Naturanza Food — database migration runner.
 *
 * Discovers every `schema/migrations/*.sql` file, applies the ones this database
 * has not run yet, and records each in the `schema_migrations` table so it is
 * never applied twice.
 *
 * Usage:
 *   node run-migration.js                     apply every pending migration
 *   node run-migration.js --status            list applied / pending, change nothing
 *   node run-migration.js --dry-run           show what would run, change nothing
 *   node run-migration.js --only 027          apply one migration by number or filename
 *   node run-migration.js --only 027 --force  re-apply one that is already recorded
 *   node run-migration.js --baseline          record every pending migration as applied
 *                                             WITHOUT running it (see below)
 *   node run-migration.js --baseline --except 011,027
 *                                             baseline everything except those two,
 *                                             which stay pending and still run
 *
 * `--baseline` exists for databases that were migrated by hand before this
 * tracking table did. Run `--status` first and confirm the pending list really is
 * already in the schema, because baselining a migration that never ran means it
 * never will. Where a hand-migrated database is missing a few files, name them with
 * `--except` so they stay pending, then apply them normally.
 *
 * Order: numeric prefix first, then filename — so `007_a` runs before `007_b`, and
 * unnumbered legacy files run last. Order is independent of what the filesystem
 * happens to return.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { dbPool } = require("./config/db");

const MIGRATIONS_DIR = path.join(__dirname, "schema", "migrations");

/**
 * Errors that mean "this change is already in place". Migrations are written to be
 * idempotent, but MySQL has no `IF NOT EXISTS` guard for indexes, foreign keys or
 * DROPs, so re-running a file surfaces these instead. Anything not listed here — a
 * syntax error, a missing table, a failed constraint — is a real failure and aborts
 * the run.
 */
const BENIGN_ERROR_CODES = new Set([
  "ER_DUP_FIELDNAME", // 1060 ADD COLUMN that is already there
  "ER_TABLE_EXISTS_ERROR", // 1050 CREATE TABLE that is already there
  "ER_DUP_KEYNAME", // 1061 index/key that is already there
  "ER_FK_DUP_NAME", // 1826 constraint that is already there
  "ER_CANT_DROP_FIELD_OR_KEY", // 1091 DROP of something already gone
  "ER_DUP_ENTRY", // 1062 seed INSERT that already landed
]);

const USAGE = `
Naturanza Food migration runner

  node run-migration.js                     apply every pending migration
  node run-migration.js --status            list applied / pending, change nothing
  node run-migration.js --dry-run           show what would run, change nothing
  node run-migration.js --only <n|file>     apply a single migration
  node run-migration.js --only <n> --force  re-apply an already-recorded migration
  node run-migration.js --baseline          mark pending migrations applied without running them
  node run-migration.js --except <n,n,...>  hold these back from the run or baseline
`;

/**
 * Split a migration file into statements.
 *
 * A plain `sql.split(";")` breaks the moment a semicolon appears inside a string
 * literal or a comment, so this walks the file tracking quote and comment state and
 * only cuts on a semicolon that is genuinely a statement terminator.
 */
const splitSqlStatements = (sql) => {
  const statements = [];
  let current = "";
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        current += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      current += char;
      if (char === "\\" && quote !== "`" && next !== undefined) {
        current += next;
        i += 1;
        continue;
      }
      if (char === quote) {
        if (next === quote) {
          current += next;
          i += 1;
          continue;
        }
        quote = null;
      }
      continue;
    }

    // `--` only opens a comment when followed by whitespace or end-of-file, which is
    // what keeps it from swallowing an expression like `a--b`.
    if (char === "-" && next === "-" && (sql[i + 2] === undefined || /\s/.test(sql[i + 2]))) {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (char === "#") {
      inLineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ";") {
      statements.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  statements.push(current.trim());
  return statements.filter(Boolean);
};

const previewOf = (statement, length = 90) => {
  const flat = statement.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
};

const sortKeyOf = (filename) => {
  const match = /^(\d+)/.exec(filename);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const discoverMigrations = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .sort((a, b) => sortKeyOf(a) - sortKeyOf(b) || a.localeCompare(b))
    .map((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");

      // The `;`-splitter would quietly mangle a routine body into fragments, so
      // refuse the file instead of half-applying it.
      if (/^\s*DELIMITER\b/im.test(sql)) {
        throw new Error(
          `${name} uses DELIMITER. Stored routines are not supported by this runner — ` +
            "apply the file with the mysql client instead.",
        );
      }

      return {
        name,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    });
};

const ensureTrackingTable = async () => {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      statement_count INT NOT NULL DEFAULT 0,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const readAppliedMigrations = async () => {
  const [rows] = await dbPool.query(
    "SELECT name, checksum, applied_at FROM schema_migrations",
  );
  return new Map(rows.map((row) => [row.name, row]));
};

const recordMigration = async (migration, statementCount) => {
  await dbPool.query(
    `INSERT INTO schema_migrations (name, checksum, statement_count)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       checksum = VALUES(checksum),
       statement_count = VALUES(statement_count),
       applied_at = CURRENT_TIMESTAMP`,
    [migration.name, migration.checksum, statementCount],
  );
};

const applyMigration = async (migration) => {
  const statements = splitSqlStatements(migration.sql);
  let skipped = 0;
  let ignoredUse = 0;

  // One dedicated connection for the whole file. Three migrations wrap their work
  // in an explicit START TRANSACTION … COMMIT, and on a pool those statements land
  // on whichever connection happens to be free — the COMMIT would not be closing
  // the transaction it was written for.
  const connection = await dbPool.getConnection();

  try {
    // MySQL commits DDL implicitly, so a file that fails part-way cannot be rolled
    // back as a unit — which is exactly why every migration has to stay re-runnable.
    for (const statement of statements) {
      // `USE <db>` hardcodes the database name `naturanza_food`, which does not
      // exist on deployments where the host generates the name (Hostinger does).
      // The connection is already on the configured database, so the statement is
      // redundant at best and breaks the migration at worst.
      if (/^USE\s/i.test(statement)) {
        ignoredUse += 1;
        continue;
      }

      try {
        await connection.query(statement);
      } catch (error) {
        if (!BENIGN_ERROR_CODES.has(error.code)) {
          error.message = `${migration.name} — ${error.message}\n   statement: ${previewOf(statement)}`;
          throw error;
        }
        skipped += 1;
      }
    }
  } catch (error) {
    // The file may have opened a transaction before it failed; never hand a
    // connection back to the pool mid-transaction.
    await connection.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    connection.release();
  }

  await recordMigration(migration, statements.length);
  return { total: statements.length, skipped, ignoredUse };
};

const resolveOnly = (migrations, selector) => {
  const needle = selector.toLowerCase().replace(/\.sql$/, "");
  const matches = migrations.filter(
    (migration) =>
      migration.name.toLowerCase() === `${needle}.sql` ||
      migration.name.toLowerCase().startsWith(`${needle}_`),
  );

  if (!matches.length) {
    throw new Error(`No migration matches "${selector}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `"${selector}" matches ${matches.length} migrations — pass a full filename:\n` +
        matches.map((migration) => `   ${migration.name}`).join("\n"),
    );
  }
  return matches[0];
};

const reportDrift = (drifted) => {
  if (!drifted.length) {
    return;
  }
  console.warn(
    "\n⚠️  These migrations changed on disk after they were applied. Never edit an " +
      "applied migration — add a new one instead:",
  );
  drifted.forEach((migration) => console.warn(`   ${migration.name}`));
};

const printStatus = (migrations, applied, drifted) => {
  const pending = migrations.filter((migration) => !applied.has(migration.name));

  console.log(`\n${migrations.length} migration file(s) in schema/migrations\n`);
  migrations.forEach((migration) => {
    const record = applied.get(migration.name);
    if (!record) {
      console.log(`   pending  ${migration.name}`);
      return;
    }
    const changed = record.checksum !== migration.checksum ? "  (changed on disk!)" : "";
    const when = new Date(record.applied_at).toISOString().replace("T", " ").slice(0, 19);
    console.log(`   applied  ${migration.name}  ${when}${changed}`);
  });

  console.log(
    `\n${applied.size} applied, ${pending.length} pending${drifted.length ? `, ${drifted.length} changed on disk` : ""}`,
  );
  reportDrift(drifted);
};

const parseArgs = (argv) => {
  const options = {
    status: false,
    dryRun: false,
    baseline: false,
    force: false,
    help: false,
    only: null,
    except: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--status") {
      options.status = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--baseline") {
      options.baseline = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--only") {
      options.only = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--only=")) {
      options.only = arg.slice("--only=".length);
    } else if (arg === "--except") {
      options.except = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--except=")) {
      options.except = arg.slice("--except=".length);
    } else {
      throw new Error(`Unknown option: ${arg}\n${USAGE}`);
    }
  }

  if (options.only !== null && !options.only) {
    throw new Error("--only needs a migration number or filename");
  }
  if (options.except !== null && !options.except) {
    throw new Error("--except needs a comma-separated list of migrations");
  }
  if (options.force && !options.only) {
    throw new Error("--force only applies together with --only");
  }
  if (options.only && options.except) {
    throw new Error("--only and --except contradict each other; pass one or the other");
  }

  return options;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const migrations = discoverMigrations();
  await ensureTrackingTable();
  const applied = await readAppliedMigrations();
  const drifted = migrations.filter(
    (migration) =>
      applied.has(migration.name) && applied.get(migration.name).checksum !== migration.checksum,
  );

  if (options.status) {
    printStatus(migrations, applied, drifted);
    return 0;
  }

  let queue;
  if (options.only) {
    const migration = resolveOnly(migrations, options.only);
    if (applied.has(migration.name) && !options.force) {
      console.log(`ℹ️  ${migration.name} is already applied. Pass --force to re-apply it.`);
      return 0;
    }
    queue = [migration];
  } else {
    queue = migrations.filter((migration) => !applied.has(migration.name));
  }

  if (options.except) {
    const held = new Set(
      options.except
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => resolveOnly(migrations, selector).name),
    );
    queue = queue.filter((migration) => !held.has(migration.name));
    console.log(`\nHeld back (still pending after this run):`);
    [...held].forEach((name) => console.log(`   ${name}`));
  }

  if (!queue.length) {
    console.log(`✅ Database is up to date — ${applied.size} migration(s) applied, nothing pending.`);
    reportDrift(drifted);
    return 0;
  }

  if (options.dryRun) {
    console.log(`\nWould apply ${queue.length} migration(s):\n`);
    queue.forEach((migration) => {
      console.log(`   ${migration.name}  (${splitSqlStatements(migration.sql).length} statements)`);
    });
    reportDrift(drifted);
    return 0;
  }

  if (options.baseline) {
    console.log(`\n⚠️  Recording ${queue.length} migration(s) as applied WITHOUT running them:\n`);
    for (const migration of queue) {
      await recordMigration(migration, splitSqlStatements(migration.sql).length);
      console.log(`   baselined  ${migration.name}`);
    }
    console.log("\n✅ Baseline recorded. Verify the schema really does match these files.");
    return 0;
  }

  console.log(`\n📦 Applying ${queue.length} migration(s)…\n`);

  for (const migration of queue) {
    const { total, skipped, ignoredUse } = await applyMigration(migration);
    const notes = [];
    if (skipped) {
      notes.push(`${skipped}/${total} already in place`);
    }
    if (ignoredUse) {
      notes.push(`${ignoredUse} USE statement(s) ignored`);
    }
    console.log(`   ✓ ${migration.name}${notes.length ? ` (${notes.join(", ")})` : ""}`);
  }

  console.log(`\n✅ Applied ${queue.length} migration(s).`);
  reportDrift(drifted);
  return 0;
};

// Guarded so the pure helpers above can be unit-tested without opening a connection.
if (require.main === module) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`\n❌ Migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await dbPool.end();
    });
}

module.exports = {
  BENIGN_ERROR_CODES,
  discoverMigrations,
  parseArgs,
  resolveOnly,
  splitSqlStatements,
};
