-- Migration 016: Harden advance_payment_verifications schema
-- Three fixes that protect data integrity for the COD + prepaid flows:
--   1. order_id becomes INT (was VARCHAR(20)) so it can hold a real FK
--   2. amount becomes DECIMAL(10,2) (was INT) to preserve sub-rupee precision
--   3. order_id gets a FK to orders.id with ON DELETE CASCADE so deleting an
--      order automatically cleans up its verifications (no more orphans).
-- Re-runnable: the runner swallows ER_FK_DUP_NAME / re-issued MODIFY no-ops.

-- 1) Clean any orphan rows so the FK add can succeed
DELETE v FROM advance_payment_verifications v
LEFT JOIN orders o ON CAST(v.order_id AS UNSIGNED) = o.id
WHERE o.id IS NULL;

-- 2) Tighten the order_id column type so it matches orders.id
ALTER TABLE advance_payment_verifications
    MODIFY COLUMN order_id INT NOT NULL;

-- 3) Currency precision: store amount as DECIMAL(10,2) like orders.total_amount
ALTER TABLE advance_payment_verifications
    MODIFY COLUMN amount DECIMAL(10, 2) NOT NULL;

-- 4) Add the foreign key with cascade delete
ALTER TABLE advance_payment_verifications
    ADD CONSTRAINT fk_apv_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
