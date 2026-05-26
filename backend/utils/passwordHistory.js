const bcrypt = require("bcryptjs");

const PASSWORD_HISTORY_LIMIT = 5;
const PASSWORD_HISTORY_EXPIRY_DAYS = 365;

const ensurePasswordHistoryTable = async (dbConnection) => {
  try {
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS password_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);
    return true;
  } catch (error) {
    return false;
  }
};

const addPasswordToHistory = async (dbConnection, userId, newPassword) => {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await dbConnection.query(
      "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
      [userId, hashedPassword]
    );

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - PASSWORD_HISTORY_EXPIRY_DAYS);

    await dbConnection.query(
      "DELETE FROM password_history WHERE user_id = ? AND created_at < ?",
      [userId, expiryDate]
    );

    await dbConnection.query(`
      DELETE ph FROM password_history ph
      INNER JOIN (
        SELECT id FROM password_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ${PASSWORD_HISTORY_LIMIT}
      ) latest ON ph.id <= latest.id
      WHERE ph.user_id = ?
    `, [userId, userId]);

    return true;
  } catch (error) {
    return false;
  }
};

const isPasswordInHistory = async (dbConnection, userId, newPassword) => {
  try {
    const [historyRows] = await dbConnection.query(
      "SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    if (historyRows.length === 0) {
      return false;
    }

    for (const row of historyRows) {
      const isReused = await bcrypt.compare(newPassword, row.password_hash);
      if (isReused) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
};

const clearPasswordHistory = async (dbConnection, userId) => {
  try {
    await dbConnection.query(
      "DELETE FROM password_history WHERE user_id = ?",
      [userId]
    );
    return true;
  } catch (error) {
    return false;
  }
};

const hasReusedPassword = async (dbConnection, userId, newPassword, historyCount = PASSWORD_HISTORY_LIMIT) => {
  try {
    const [historyRows] = await dbConnection.query(
      `SELECT password_hash FROM password_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, historyCount]
    );

    for (const row of historyRows) {
      const isReused = await bcrypt.compare(newPassword, row.password_hash);
      if (isReused) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
};

module.exports = {
  ensurePasswordHistoryTable,
  addPasswordToHistory,
  isPasswordInHistory,
  clearPasswordHistory,
  hasReusedPassword,
  PASSWORD_HISTORY_LIMIT,
  PASSWORD_HISTORY_EXPIRY_DAYS,
};