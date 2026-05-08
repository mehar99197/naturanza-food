-- Admin Management System Upgrade Migration
-- Created: 2026-04-23
-- Description: Adds role-based permissions, audit logs, and profile pictures

-- Step 1: Alter admins table (using users table as admins are stored there with role='admin')
-- Add new columns for enhanced admin management

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_role ENUM('super_admin', 'staff_admin') DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_permissions JSON DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login DATETIME DEFAULT NULL;

-- Update existing admin users to have super_admin role
UPDATE users 
SET admin_role = 'super_admin' 
WHERE role = 'admin' AND admin_role IS NULL;

-- Step 2: Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(500) NOT NULL,
  ip_address VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_audit_logs_admin (admin_id, created_at),
  INDEX idx_admin_audit_logs_created (created_at)
);

-- Note: profile_image column already exists in users table
-- We will use that for profile pictures
