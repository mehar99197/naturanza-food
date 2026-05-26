-- 004_add_user_auth_origin_columns.sql
-- Purpose: support first-time password setup for social signups.

USE naturanza_food;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_provider ENUM('password', 'google') DEFAULT 'password' AFTER address;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_set_by_user BOOLEAN DEFAULT TRUE AFTER signup_provider;
