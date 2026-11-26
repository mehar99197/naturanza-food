-- Convert newsletter subscriptions to double opt-in.
-- Existing active subscribers stay active; new subscriptions start as pending
-- until the user clicks the verification link.

ALTER TABLE newsletter_subscribers
  MODIFY COLUMN status ENUM('pending', 'active', 'unsubscribed') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_newsletter_verification_token (verification_token);

-- Backfill verified_at for existing active/unsubscribed rows without altering
-- their status (never re-activate unsubscribed users).
UPDATE newsletter_subscribers
SET verified_at = COALESCE(verified_at, subscribed_at)
WHERE status IN ('active', 'unsubscribed') AND verified_at IS NULL;
