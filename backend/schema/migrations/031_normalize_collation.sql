-- Migration: Normalize the two stragglers onto the schema-wide collation
-- Date: 2026-08-14
-- Description:
--   The schema had drifted onto two collations at once. schema/database.sql built
--   tables as utf8mb4_unicode_ci, but 017_add_blog_posts.sql and
--   026_add_email_verification.sql declared utf8mb4_0900_ai_ci, so any database
--   that ran them ended up mixed. Comparing string columns across the two groups
--   raises "Illegal mix of collations" at query time, and utf8mb4_0900_ai_ci does
--   not exist before MariaDB 11.4 — production runs MariaDB, where an older
--   version would reject those migrations outright.
--
--   Both migration files now declare utf8mb4_unicode_ci, so a fresh install never
--   sees the mix and this file is a no-op there. It exists to converge databases
--   that already ran the earlier versions.
--
--   Scope is deliberately these two tables and not "every table". A live check of
--   production (MariaDB 11.8.8) showed the database default collation is already
--   utf8mb4_unicode_ci and 43 of 45 tables are already correct — only these two
--   are wrong, and they hold 2 rows and 0 rows respectively. Converting the whole
--   schema would rebuild large tables such as orders, products and users, taking
--   write locks on a live store, to change nothing.
--
--   Safe to re-run: converting a table that is already utf8mb4_unicode_ci is a
--   no-op. No foreign key in this schema sits on a string column, so converting a
--   table at a time cannot break referential integrity partway through.

-- Applies to the current database — never name it, the name differs per deployment.
ALTER DATABASE
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

ALTER TABLE blog_posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE email_verification_codes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
