-- Migration: Add admin_role and admin_permissions columns to users table
-- Date: 2026-05-16
-- Description: Fixes 500 errors when authenticated users access their profile

-- Add admin_role column for admin users
ALTER TABLE users 
ADD COLUMN admin_role ENUM('super_admin', 'admin', 'moderator') DEFAULT NULL AFTER role;

-- Add admin_permissions column for granular permissions
ALTER TABLE users 
ADD COLUMN admin_permissions JSON DEFAULT NULL AFTER admin_role;

-- Update existing admin users to have super_admin role
UPDATE users 
SET admin_role = 'super_admin' 
WHERE role = 'admin';

-- Verify the changes
-- SELECT id, name, email, role, admin_role, admin_permissions FROM users;
