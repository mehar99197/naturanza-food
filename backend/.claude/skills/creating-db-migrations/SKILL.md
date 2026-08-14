---
name: creating-db-migrations
description: Author and apply a numbered MySQL schema migration for the Naturanza Food backend. Use when adding/altering a table or column, or evolving the database schema. Follows the existing schema/migrations/0XX_name.sql convention (idempotent, IF NOT EXISTS), keeps schema/database.sql in sync, and applies the file with the auto-discovering run-migration.js runner.
---

# Creating a DB migration

Migrations live in `schema/migrations/` as zero-padded numbered SQL files and are applied with
`run-migration.js`. Match an existing file (e.g. `schema/migrations/007_add_category_type.sql`) for
exact format.

## Steps

1. **Find the next number.** List `schema/migrations/` and take the highest `0XX_` prefix + 1
   (e.g. existing top is `031_*` → new file is `032_*`). Name it descriptively:
   `032_add_things_table.sql` or `032_add_priority_to_things.sql`.

   The number must be unique and must place the file *after* whatever it depends on — a migration
   that alters a table has to run after the one that creates it. `test/migration-runner.test.js`
   fails the build on duplicate numbers, so don't reuse one.

2. **Write idempotent SQL.** It must be safe to re-run. The runner splits statements on `;` while
   respecting quoted strings and comments, and tolerates the "already exists" error family (duplicate
   column, table, key or constraint, and DROP of something already gone) — so existing migrations use
   `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` (see `007_add_category_type.sql`):
   ```sql
   -- 013_add_things_table.sql
   CREATE TABLE IF NOT EXISTS things (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     is_active BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   ALTER TABLE things
     ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0 AFTER is_active;
   ```
   Keep each statement `;`-terminated and avoid stored procedures / `DELIMITER` blocks (the naive split
   on `;` would break them).

3. **Keep `schema/database.sql` in sync.** Add the same table/column to the canonical schema so a fresh
   DB built from `database.sql` matches a migrated one. Use `utf8mb4` and `ENGINE=InnoDB` to match.

4. **Apply the migration.** `run-migration.js` discovers every `schema/migrations/*.sql`, applies the
   ones this database has not run yet, and records each in the `schema_migrations` table so none is
   ever applied twice. Do not write a per-migration runner script — there is one runner:
   ```bash
   npm run migrate:status                    # what is applied vs. pending
   npm run migrate                           # apply everything pending
   node run-migration.js --dry-run           # show what would run, change nothing
   node run-migration.js --only 032          # apply just this one
   node run-migration.js --only 032 --force  # re-apply one already recorded
   ```
   Files run in numeric-prefix order, and each gets its own connection so an explicit
   `START TRANSACTION … COMMIT` inside a migration behaves.

   **Never write `USE <db>` or name a database in `ALTER DATABASE`** — the connection is already on the
   configured database, and the name differs per deployment (Hostinger generates it). `ALTER DATABASE`
   with no name applies to the current one. A test enforces this; the runner also skips stray `USE`
   statements as a backstop.

   On a database that was migrated by hand before `schema_migrations` existed, run `--status` first,
   confirm the pending list really is already in the schema, then `node run-migration.js --baseline` to
   record those files as applied without re-running them.

   **`--baseline` marks *everything* pending, including migrations that genuinely have not run yet.**
   If the pending list mixes already-applied files with a genuinely new one, baseline first and then
   force the new file so it actually executes:
   ```bash
   node run-migration.js --baseline           # records 000…031 as applied
   node run-migration.js --only 031 --force   # but 031 never ran — run it for real
   ```

5. **Verify:** `SHOW TABLES;` / `SHOW COLUMNS FROM things;`. The model layer may also add a
   `SHOW COLUMNS ... LIKE` compat guard for new columns — see `hasCategoryTypeColumn` in `categoryModel.js`.

## Rules

- One logical change per migration file; never edit an already-applied migration — add a new one.
- Always `IF NOT EXISTS` / guarded so re-running is harmless.
- PKR money columns: use `DECIMAL(10,2)`. Enums (e.g. payment_method) must match the values used in code.
- After migrating, run `/reviewing-code-quality` and remove any scratch/seed SQL not meant to ship.
