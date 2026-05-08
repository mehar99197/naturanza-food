const { dbPool } = require("./config/db");

const createTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      email VARCHAR(100) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      used_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_token_hash (token_hash),
      INDEX idx_password_reset_user (user_id, is_used, expires_at),
      INDEX idx_password_reset_email (email, is_used),
      INDEX idx_password_reset_expires (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `;

  try {
    await dbPool.query(sql);
    console.log("✅ password_reset_tokens table created successfully!");
    
    // Verify
    const [tables] = await dbPool.query("SHOW TABLES LIKE 'password_reset_tokens'");
    console.log("Tables found:", tables.length > 0 ? "YES" : "NO");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
};

createTable();
