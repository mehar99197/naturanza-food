-- Email verification for self-signup (password) accounts.
-- Adds an email_verified flag on users and a one-time-code table.
-- Existing users are grandfathered in (verified) so nobody gets locked out.
--
-- Must run before 029_bind_verification_credential.sql, which alters the table
-- created here.

-- DEFAULT TRUE is what performs the grandfathering: adding a column WITH a default
-- backfills every existing row with it, so no follow-up UPDATE is needed. That
-- distinction matters because ADD COLUMN IF NOT EXISTS is skipped on a re-run but a
-- bare `UPDATE users SET email_verified = TRUE` is not — the earlier form re-verified
-- every pending signup any time this file ran again.
--
-- The default also keeps the admin-creation paths working: routes/adminManagement.js
-- and routes/admin.js insert admins without naming this column, and admin login does
-- not gate on it. Password self-signup writes FALSE explicitly (routes/auth.js) and
-- is the only flow that must be gated. This mirrors ensureColumns() in
-- utils/schemaCompatibility.js, which asserts the same definition on every boot.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(254) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    -- Password submitted with the registration attempt that issued this code.
    -- Applied to users.password only on successful verification — see 029.
    credential_hash VARCHAR(255) NULL,
    -- SHA-256 of the nonce handed to the registrant's browser, proving the
    -- person entering the code is the person who registered.
    verifier_nonce_hash CHAR(64) NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_evc_user (user_id, is_used, expires_at),
    INDEX idx_evc_email (email, is_used),
    INDEX idx_evc_expires (expires_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
