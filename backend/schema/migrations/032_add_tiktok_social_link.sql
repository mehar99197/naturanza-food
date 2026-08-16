-- Migration 032: Add TikTok to the admin-managed social links.
-- Re-runnable: duplicate-column errors are swallowed by the migration runner.

ALTER TABLE admin_settings
    ADD COLUMN tiktok_url VARCHAR(255) NOT NULL DEFAULT '';