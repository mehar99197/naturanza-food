-- Migration 021: per-user coupon redemption ledger
-- Closes: coupons had no per-user redemption cap, so one customer could reuse a
-- one-time/welcome coupon on unlimited orders (only the global usage_limit was
-- checked at checkout). UNIQUE(coupon_id, user_id) is the authoritative guard;
-- routes/orders.js checks it (friendly 409) and inserts a row on each redemption.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_coupon_user (coupon_id, user_id),
    KEY idx_coupon_redemptions_user (user_id)
);
