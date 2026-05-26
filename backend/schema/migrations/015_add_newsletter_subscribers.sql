-- Migration 015: Newsletter subscribers + welcome promo code setting
-- Creates the newsletter_subscribers table (used by the "Join the Naturanza
-- Family" form on the storefront) and adds a configurable welcome promo code
-- column to admin_settings so the welcome email can advertise a discount.
-- Re-runnable: duplicate-column errors are swallowed by the runner.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    status ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
    unsubscribe_token VARCHAR(64) NOT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'footer',
    subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP NULL DEFAULT NULL,
    reactivated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_newsletter_status (status),
    INDEX idx_newsletter_email (email)
);

ALTER TABLE admin_settings
    ADD COLUMN newsletter_welcome_promo_code VARCHAR(40) NOT NULL DEFAULT '';
