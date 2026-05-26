-- Security Settings tables for profile module

CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    login_provider VARCHAR(50) DEFAULT 'password',
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at DATETIME,
    revoked_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_session_token (token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_sessions_user_active (user_id, is_active),
    INDEX idx_user_sessions_last_seen (last_seen_at)
);

CREATE TABLE IF NOT EXISTS user_login_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    attempted_email VARCHAR(120),
    login_provider VARCHAR(50) DEFAULT 'password',
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    device_name VARCHAR(120),
    location_label VARCHAR(180),
    status ENUM('success', 'failed') NOT NULL DEFAULT 'failed',
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_login_history_user_created (user_id, created_at),
    INDEX idx_user_login_history_email_created (attempted_email, created_at)
);
