const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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

async function resetAdminPassword() {
  try {
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

    console.log('\n🔐 Resetting Admin Password...\n');
    
    const newPassword = DEFAULT_ADMIN_PASSWORD;
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await conn.query(
      "UPDATE users SET password = ?, role = 'admin', admin_role = 'super_admin', is_active = TRUE WHERE email = ?",
      [hashedPassword, DEFAULT_ADMIN_EMAIL]
    );
    
    console.log('✅ Password reset successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('   ADMIN LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log(`   📧 Email:    ${DEFAULT_ADMIN_EMAIL}`);
    console.log('   🔑 Password: (from DEFAULT_ADMIN_PASSWORD in .env)');
    console.log('');
    console.log('   🌐 Login URL: http://localhost:5173/admin/login');
    console.log('');
    console.log('═══════════════════════════════════════\n');

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetAdminPassword();
