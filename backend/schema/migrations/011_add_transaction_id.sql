-- 011_add_transaction_id.sql
-- Adds Transaction ID (TID) capture + UNIQUE enforcement to block duplicate submissions.
-- Primary location: advance_payment_verifications (where the submission INSERT happens).
-- Mirror on orders: populated on admin approval for fast lookup / reporting.

START TRANSACTION;

ALTER TABLE advance_payment_verifications
  ADD COLUMN transaction_id VARCHAR(50) NULL AFTER payment_method,
  ADD CONSTRAINT uq_apv_transaction_id UNIQUE (transaction_id);

ALTER TABLE orders
  ADD COLUMN transaction_id VARCHAR(50) NULL AFTER payment_status,
  ADD CONSTRAINT uq_orders_transaction_id UNIQUE (transaction_id);

-- Speeds up the analytics aggregation in Module 2 (status + created_at filters).
CREATE INDEX idx_apv_status_created
  ON advance_payment_verifications (status, created_at);

COMMIT;
