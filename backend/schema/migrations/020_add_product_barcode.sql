-- Migration 020: Retail barcode on products (replaces the QR code)
--
-- Products are now sold through physical stores, so each one carries a scannable
-- 1D retail barcode (EAN-13 / UPC-A / EAN-8) instead of a QR code pointing at the
-- product page. A POS terminal can read the code at checkout.
--
--   * barcode is NULL-able + UNIQUE. MySQL allows many NULLs in a unique index,
--     so products awaiting a code do not collide.
--   * Existing rows are backfilled on the next server boot by
--     ensureProductionSchema() -> ensureProductBarcodes(), which generates an
--     internal EAN-13 (GS1 restricted-distribution prefix 200-299) per product.
--     The check-digit algorithm lives in ONE place, utils/barcode.js, so it is
--     deliberately not duplicated here in SQL.
--   * qr_code_url is dropped: it only ever held a re-derivable product URL that
--     no admin could set, and nothing reads it after this change.
--
-- Re-runnable: duplicate-column / unknown-column errors are swallowed by the runner.

ALTER TABLE products
    ADD COLUMN barcode VARCHAR(20) NULL AFTER slug;

ALTER TABLE products
    ADD UNIQUE KEY uq_products_barcode (barcode);

ALTER TABLE products
    DROP COLUMN qr_code_url;
