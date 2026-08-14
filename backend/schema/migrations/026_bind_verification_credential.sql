-- Migration: Bind the signup password to the verification code that activates it
-- Date: 2026-08-13
-- Description:
--   Closes the pre-registration account-takeover path (audit H-01, second door).
--
--   Previously POST /register wrote the submitted password straight onto the
--   users row and left it there while the account sat unverified. Anyone could
--   register an address they do not own; when the real owner later verified the
--   emailed code, the account activated carrying the *attacker's* password.
--
--   The password is now held against the verification code that was issued for
--   that specific registration attempt, and is applied to the users row only at
--   verification time. `verifier_nonce_hash` is the SHA-256 of a random nonce
--   handed to the registrant's browser in an HttpOnly cookie, so verification
--   can tell "the person entering this code is the person who registered" from
--   "someone else's registration is being completed". Without a nonce match the
--   account still activates, but with no usable password — the owner sets one
--   through the existing first-time password setup.
--
--   Both columns are nullable: codes issued before this migration simply carry
--   no credential, and verifying one activates the account without a password.

ALTER TABLE email_verification_codes
ADD COLUMN IF NOT EXISTS credential_hash VARCHAR(255) NULL AFTER code_hash;

ALTER TABLE email_verification_codes
ADD COLUMN IF NOT EXISTS verifier_nonce_hash CHAR(64) NULL AFTER credential_hash;
