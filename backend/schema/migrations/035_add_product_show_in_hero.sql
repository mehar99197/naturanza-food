-- Migration 035: Add show_in_hero visibility toggle to products so admins can
-- control which products appear in the homepage top hero carousel.
-- Re-runnable: duplicate-column errors are swallowed by the migration runner.

ALTER TABLE products
    ADD COLUMN show_in_hero BOOLEAN NOT NULL DEFAULT TRUE AFTER is_featured;
