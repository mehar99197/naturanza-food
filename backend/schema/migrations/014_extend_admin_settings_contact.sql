-- Migration 014: Extend admin_settings with contact/social/map/whatsapp columns
-- Adds 11 new columns so the user-side Contact page (address, hours, socials,
-- map coords, "Visit Our Store" label, and WhatsApp floating button) can be
-- managed entirely from the admin Settings dashboard.
-- Re-runnable: duplicate-column errors are swallowed by the runner.

ALTER TABLE admin_settings
    ADD COLUMN address VARCHAR(255) NOT NULL DEFAULT 'Pakistan',
    ADD COLUMN support_hours VARCHAR(120) NOT NULL DEFAULT 'Available 24/7',
    ADD COLUMN facebook_url VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN instagram_url VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN twitter_url VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN youtube_url VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN whatsapp_number VARCHAR(30) NOT NULL DEFAULT '',
    ADD COLUMN whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN map_latitude DECIMAL(10, 7) NOT NULL DEFAULT 31.5204000,
    ADD COLUMN map_longitude DECIMAL(10, 7) NOT NULL DEFAULT 74.3587000,
    ADD COLUMN map_location_label VARCHAR(120) NOT NULL DEFAULT 'Pakistan, Lahore';
