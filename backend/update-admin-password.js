const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'naturanza_food';
const DEFAULT_ADMIN_EMAIL = String(process.env.DEFAULT_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || '');

async function updateAdminPassword() {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    console.error('Missing DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD in .env');
    process.exitCode = 1;
    return;
  }

  if (DEFAULT_ADMIN_PASSWORD.length < 12) {
    console.error('DEFAULT_ADMIN_PASSWORD must be at least 12 characters');
    process.exitCode = 1;
    return;
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });

  try {
    const newPassword = DEFAULT_ADMIN_PASSWORD;
    const email = DEFAULT_ADMIN_EMAIL;
    const hash = await bcrypt.hash(newPassword, 12);

    const [result] = await conn.execute(
      `UPDATE users
          SET password = ?, role = 'admin', admin_role = 'super_admin', is_active = TRUE,
              failed_login_attempts = 0, locked_until = NULL,
              user_failed_login_attempts = 0, user_locked_until = NULL,
              admin_failed_login_attempts = 0, admin_locked_until = NULL
        WHERE email = ?`,
      [hash, email]
    );

    if (result.affectedRows > 0) {
      const [[adminRow]] = await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (adminRow?.id) {
        await conn.execute('UPDATE user_sessions SET is_active = FALSE, revoked_at = NOW() WHERE user_id = ? AND is_active = TRUE', [adminRow.id]).catch(() => {});
        await conn.execute("UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = 'admin_password_reset' WHERE user_id = ? AND revoked_at IS NULL", [adminRow.id]).catch(() => {});
      }
      console.log('Password updated successfully and existing sessions revoked.');
      console.log(`Email: ${email}`);
    } else {
      const [insertResult] = await conn.execute(
        "INSERT INTO users (name, email, password, role, admin_role, is_active, email_verified) VALUES (?, ?, ?, 'admin', 'super_admin', TRUE, TRUE)",
        ['Default Admin', email, hash]
      );

      if (insertResult.affectedRows > 0) {
        console.log('Admin user created successfully.');
        console.log(`Email: ${email}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

updateAdminPassword();
