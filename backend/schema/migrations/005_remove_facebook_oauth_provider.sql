-- 005_remove_facebook_oauth_provider.sql
-- Purpose: remove Facebook OAuth provider references from auth-related data.

USE naturanza_food;

UPDATE users
SET signup_provider = 'password'
WHERE signup_provider = 'facebook';

ALTER TABLE users
  MODIFY COLUMN signup_provider ENUM('password', 'google') DEFAULT 'password';

UPDATE user_sessions
SET login_provider = 'password'
WHERE LOWER(login_provider) = 'facebook';

UPDATE user_login_history
SET login_provider = 'password'
WHERE LOWER(login_provider) = 'facebook';
