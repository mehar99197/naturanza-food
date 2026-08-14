-- Separate user-portal and admin-portal lockout counters.
-- Prevents a brute-force attack on the customer login form from locking
-- the same account out of the admin portal (and vice versa).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_locked_until DATETIME NULL,
  ADD COLUMN IF NOT EXISTS admin_failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_locked_until DATETIME NULL;

-- Copy any existing legacy lockout state into both new contexts so existing
-- locked accounts stay locked after deploy.
UPDATE users
SET
  user_failed_login_attempts = GREATEST(user_failed_login_attempts, failed_login_attempts),
  user_locked_until = COALESCE(user_locked_until, locked_until),
  admin_failed_login_attempts = GREATEST(admin_failed_login_attempts, failed_login_attempts),
  admin_locked_until = COALESCE(admin_locked_until, locked_until)
WHERE failed_login_attempts > 0 OR locked_until IS NOT NULL;
