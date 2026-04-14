-- 002_remove_user_wellness_profiles.sql
-- Purpose: remove deprecated wellness profile table.

USE naturanza_foods;

DROP TABLE IF EXISTS user_wellness_profiles;
