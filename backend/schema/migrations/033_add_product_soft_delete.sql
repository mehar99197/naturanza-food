-- Migration 033: separate "deleted" from "deactivated" on products
--
-- Deleting a product can only remove the row outright when no order references
-- it: order_items.product_id is ON DELETE CASCADE and an order line carries no
-- snapshot of the product (routes/orders.js resolves the name through a JOIN),
-- so hard-deleting an ordered product would erase paid invoice lines. Those rows
-- have to stay -- but they used to stay as is_active = FALSE and nothing else,
-- and the admin Products list asks for inactive rows too (includeInactive), so a
-- deleted product never left the screen and every later click on Delete looked
-- broken.
--
-- deleted_at is the marker every product-facing query now skips, so the row is
-- invisible to the store and to the admin catalogue while the order-history JOIN
-- keeps resolving its name.
--
-- Re-runnable: duplicate-column errors are swallowed by the migration runner.

ALTER TABLE products
    ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER is_active;
