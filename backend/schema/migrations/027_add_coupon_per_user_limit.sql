-- Migration: Per-customer coupon redemption limits
-- Date: 2026-08-14
-- Description:
--   Closes the coupon reuse leak (audit M-07). Redemption was tracked only as a
--   global coupons.used_count against coupons.usage_limit — nothing recorded WHO
--   redeemed, so a single customer could apply the same code to every order they
--   placed. It compounded with order cancellation, which decrements used_count:
--   place-then-cancel restored a limited code indefinitely. The newsletter
--   welcome promo is emailed to every subscriber, which made this directly
--   monetisable.
--
--   coupon_redemptions records one row per (coupon, order). The UNIQUE key on
--   (coupon_id, user_id, order_id) makes double-counting a single order
--   impossible, and the per-user count is a cheap indexed lookup.
--
--   coupons.per_user_limit caps redemptions per customer. NULL means unlimited.
--
--   The column default is deliberately NULL, NOT 1. Adding a column WITH a
--   default backfills every existing row with it, which would silently convert
--   every promo already in circulation to one-per-customer the moment this
--   migration ran — a behaviour change nobody asked for, on live codes, with no
--   warning. Existing coupons therefore keep working exactly as they do today.
--
--   The secure default for NEW coupons is applied in the application instead
--   (routes/coupons.js: an omitted per_user_limit becomes 1), so going forward a
--   code cannot be replayed by the same customer unless someone explicitly says
--   it may be. Doing it there rather than here also keeps this file safe to
--   re-run: a backfill UPDATE would wipe limits an admin had since set, because
--   ADD COLUMN IF NOT EXISTS is skipped on a second run but an UPDATE is not.
--
--   Existing coupons are then reconciled by reconcile-coupon-limits.js, which
--   reads the real redemption history in orders.coupon_code: any code no single
--   customer has ever redeemed twice is set to 1 (provably no behaviour change),
--   and anything that HAS been reused is left alone and reported so a human can
--   decide. Run it dry first:
--
--     node reconcile-coupon-limits.js
--     node reconcile-coupon-limits.js --apply
--
--   The Coupons screen also shows the per-customer limit on every row now, so
--   whatever the script leaves unlimited is visible rather than buried.

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS per_user_limit INT NULL DEFAULT NULL AFTER usage_limit;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    code VARCHAR(50) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_coupon_redemption (coupon_id, user_id, order_id),
    INDEX idx_coupon_redemptions_user (coupon_id, user_id),
    INDEX idx_coupon_redemptions_order (order_id),

    CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupon_redemptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupon_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
