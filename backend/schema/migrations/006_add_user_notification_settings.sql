CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id INT PRIMARY KEY,
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until DATETIME,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_notification_settings_muted (is_muted, muted_until)
);
