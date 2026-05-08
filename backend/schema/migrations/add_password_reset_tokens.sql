-- Migration: Add password_reset_tokens table
-- Date: 2026-04-30
-- Description: Creates table for secure password reset token storage

-- Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(100) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for fast lookups
    INDEX idx_password_reset_token_hash (token_hash),
    INDEX idx_password_reset_user (user_id, is_used, expires_at),
    INDEX idx_password_reset_email (email, is_used),
    INDEX idx_password_reset_expires (expires_at),
    
    -- Foreign key to users table
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add comment to table
ALTER TABLE password_reset_tokens COMMENT = 'Stores hashed password reset tokens with expiry tracking';
