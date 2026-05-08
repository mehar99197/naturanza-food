-- Remove 2FA columns from users table
-- Created: 2026-05-04
-- Description: Drops admin 2FA columns (two_fa_secret, two_fa_enabled)

ALTER TABLE users
  DROP COLUMN IF EXISTS two_fa_secret,
  DROP COLUMN IF EXISTS two_fa_enabled;
