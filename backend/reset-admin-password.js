const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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

async function resetAdminPassword() {
  let conn;
  try {
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

    conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME
    });

    console.log('\nResetting Admin Password...\n');

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

    const [result] = await conn.query(
      `UPDATE users
          SET password = ?, role = 'admin', admin_role = 'super_admin', is_active = TRUE,
              failed_login_attempts = 0, locked_until = NULL,
              user_failed_login_attempts = 0, user_locked_until = NULL,
              admin_failed_login_attempts = 0, admin_locked_until = NULL
        WHERE email = ?`,
      [hashedPassword, DEFAULT_ADMIN_EMAIL]
    );

    if (result.affectedRows === 0) {
      console.error(`Admin account not found for email: ${DEFAULT_ADMIN_EMAIL}`);
      process.exitCode = 1;
      return;
    }

    const [[adminRow]] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [DEFAULT_ADMIN_EMAIL]);
    if (adminRow?.id) {
      await conn.query('UPDATE user_sessions SET is_active = FALSE, revoked_at = NOW() WHERE user_id = ? AND is_active = TRUE', [adminRow.id]).catch(() => {});
      await conn.query("UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = 'admin_password_reset' WHERE user_id = ? AND revoked_at IS NULL", [adminRow.id]).catch(() => {});
    }

    console.log('Password reset successfully and existing sessions revoked.');
    console.log(`Email: ${DEFAULT_ADMIN_EMAIL}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

resetAdminPassword();
