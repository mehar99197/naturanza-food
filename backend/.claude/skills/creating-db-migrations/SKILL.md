---
name: creating-db-migrations
description: Author and apply a numbered MySQL schema migration for the Naturanza Food backend. Use when adding/altering a table or column, or evolving the database schema. Follows the existing schema/migrations/0XX_name.sql convention (idempotent, IF NOT EXISTS) and updates schema/database.sql and run-migration.js accordingly.
---

# Creating a DB migration

Migrations live in `schema/migrations/` as zero-padded numbered SQL files and are applied with
`run-migration.js`. Match an existing file (e.g. `schema/migrations/007_add_category_type.sql`) for
exact format.

## Steps

1. **Find the next number.** List `schema/migrations/` and take the highest `0XX_` prefix + 1
   (e.g. existing top is `012_*` → new file is `013_*`). Name it descriptively:
   `013_add_things_table.sql` or `013_add_priority_to_things.sql`.

2. **Write idempotent SQL.** It must be safe to re-run. The runner splits the file on `;`, skips lines
   starting with `--`, and tolerates "Duplicate column" errors — so existing migrations use
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

4. **Apply the migration.** NOTE: `run-migration.js` is hardcoded to one file path
   (`001_admin_management_upgrade.sql`) — it does NOT auto-discover migrations. To run a different file
   either (a) temporarily point `migrationPath` in `run-migration.js` at your new file, or (b) apply it
   directly with the MySQL client:
   ```bash
   mysql -u "$DB_USER" -p "$DB_NAME" < schema/migrations/013_add_things_table.sql
   ```
   Other one-off runner scripts exist in the repo root (e.g. `run-password-reset-migration.js`,
   `run-newsletter-migration.js`) — mirror one of those if you prefer a Node script for this migration.

5. **Verify:** `SHOW TABLES;` / `SHOW COLUMNS FROM things;`. The model layer may also add a
   `SHOW COLUMNS ... LIKE` compat guard for new columns — see `hasCategoryTypeColumn` in `categoryModel.js`.

## Rules

- One logical change per migration file; never edit an already-applied migration — add a new one.
- Always `IF NOT EXISTS` / guarded so re-running is harmless.
- PKR money columns: use `DECIMAL(10,2)`. Enums (e.g. payment_method) must match the values used in code.
- After migrating, run `/reviewing-code-quality` and remove any scratch/seed SQL not meant to ship.
