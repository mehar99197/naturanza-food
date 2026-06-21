-- Migration 018: Store-wide sale discount on admin_settings
-- Adds a global percentage sale that applies to ALL products automatically
-- (separate from coupons and from per-product discount_percentage). When
-- store_discount_active is TRUE, every product price is reduced by
-- store_discount_percentage across the storefront, cart, checkout and invoice.
-- Re-runnable: duplicate-column errors are swallowed by the runner.

ALTER TABLE admin_settings
    ADD COLUMN store_discount_active BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN store_discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN store_discount_label VARCHAR(60) NOT NULL DEFAULT 'Store Sale';
