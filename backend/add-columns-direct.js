require('dotenv').config();
const mysql = require('mysql2/promise');

if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD not set. Create a .env file with DB_PASSWORD.');
  process.exit(1);
}

async function addColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'naturanza_foods'
  });

  try {
    console.log('🔧 Adding columns to users table...');
    
    // Add columns one by one to avoid errors
    const columns = [
      { name: 'admin_role', sql: "ADD COLUMN admin_role ENUM('super_admin', 'staff_admin') DEFAULT NULL" },
      { name: 'admin_permissions', sql: "ADD COLUMN admin_permissions JSON DEFAULT NULL" },
      { name: 'last_login', sql: "ADD COLUMN last_login DATETIME DEFAULT NULL" }
    ];

    for (const col of columns) {
      try {
        await connection.query(`ALTER TABLE users ${col.sql}`);
        console.log(`✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏭️  Column ${col.name} already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n🔧 Updating existing admins to super_admin...');
    await connection.query("UPDATE users SET admin_role = 'super_admin' WHERE role = 'admin'");
    console.log('✅ Updated existing admins');

    console.log('\n🔧 Creating admin_audit_logs table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        action VARCHAR(500) NOT NULL,
        ip_address VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_admin_audit_logs_admin (admin_id, created_at),
        INDEX idx_admin_audit_logs_created (created_at)
      )
    `);
    console.log('✅ Created admin_audit_logs table');

    console.log('\n✅ ALL DATABASE CHANGES COMPLETED SUCCESSFULLY!');
    console.log('🚀 Now restart backend: npm run dev');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addColumns();
