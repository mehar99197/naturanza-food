-- Admin Security Center
-- Adds TOTP 2FA, IP allowlisting, session metadata, and richer audit metadata.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_fa_secret_encrypted TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_fa_enabled_at DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS two_fa_recovery_codes JSON DEFAULT NULL;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS device_name VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(180) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS admin_security_ip_allowlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    cidr VARCHAR(64) NOT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admin_security_ip_allowlist_cidr (cidr),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_admin_security_ip_allowlist_created (created_at)
);

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'admin_action',
  ADD COLUMN IF NOT EXISTS actor_email VARCHAR(254) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT NULL,
  MODIFY COLUMN ip_address VARCHAR(64) DEFAULT NULL;
