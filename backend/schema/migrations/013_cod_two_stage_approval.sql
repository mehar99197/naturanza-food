-- 013_cod_two_stage_approval.sql
-- Two-stage COD payment approval:
--   Stage 1 = advance shipping fee (jazzcash/easypaisa with screenshot + TID)
--   Stage 2 = final cash collection on delivery (admin confirms, no screenshot)
-- Backward-compatible: pre-existing non-COD verifications backfill to 'full_payment'.

START TRANSACTION;

-- 1. Widen orders.payment_status enum to include 'partial' for the
--    in-between state after stage-1 approval and before stage-2 approval.
ALTER TABLE orders
  MODIFY COLUMN payment_status ENUM('pending','partial','paid','failed')
    NOT NULL DEFAULT 'pending';

-- 2. Stage discriminator + admin note on verifications.
ALTER TABLE advance_payment_verifications
  ADD COLUMN IF NOT EXISTS verification_stage
    ENUM('full_payment','advance_shipping','final_collection')
    NOT NULL DEFAULT 'full_payment'
    AFTER payment_method,
  ADD COLUMN IF NOT EXISTS admin_note TEXT NULL
    AFTER rejection_reason;

-- 2a. Widen payment_method to include 'cod' for auto-created stage-2 rows
--     (recorded so the admin grid can show provenance even though no screenshot
--     or wallet account is involved at stage 2).
ALTER TABLE advance_payment_verifications
  MODIFY COLUMN payment_method ENUM('jazzcash','easypaisa','bank','cod') NOT NULL;

-- 3. Backfill any legacy rows: every existing row predates this migration and
--    represents the single-stage "full payment" semantics.
UPDATE advance_payment_verifications
   SET verification_stage = 'full_payment'
 WHERE verification_stage IS NULL OR verification_stage = '';

-- 4. Index for the "COD final pending" admin filter.
CREATE INDEX IF NOT EXISTS idx_apv_stage_status
  ON advance_payment_verifications (verification_stage, status);

-- 5. At most one verification row per (order, stage). Makes both customer
--    re-submits and concurrent stage-2 auto-creates race-safe.
ALTER TABLE advance_payment_verifications
  ADD CONSTRAINT uq_apv_order_stage UNIQUE (order_id, verification_stage);

COMMIT;
