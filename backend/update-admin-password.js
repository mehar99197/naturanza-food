const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'naturanza_foods';
const DEFAULT_ADMIN_EMAIL = String(process.env.DEFAULT_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || '');

async function updateAdminPassword() {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    console.error('Missing DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD in .env');
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
      "UPDATE users SET password = ?, role = 'admin', admin_role = 'super_admin', is_active = TRUE WHERE email = ?",
      [hash, email]
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Password updated successfully!');
      console.log(`📧 Email: ${email}`);
      console.log('🔐 New Password: (from DEFAULT_ADMIN_PASSWORD in .env)');
    } else {
      console.log('❌ User not found. Creating new admin user...');
      
      const [insertResult] = await conn.execute(
        "INSERT INTO users (name, email, password, role, admin_role, is_active) VALUES (?, ?, ?, 'admin', 'super_admin', TRUE)",
        ['Default Admin', email, hash]
      );
      
      if (insertResult.affectedRows > 0) {
        console.log('✅ Admin user created successfully!');
        console.log(`📧 Email: ${email}`);
        console.log('🔐 Password: (from DEFAULT_ADMIN_PASSWORD in .env)');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
}

updateAdminPassword();
