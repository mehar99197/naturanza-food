const fs = require('fs');
const path = require('path');
const { db } = require('./config/db');

async function runMigration() {
  try {
    console.log('📦 Running Admin Management System migration...\n');
    
    const migrationPath = path.join(__dirname, 'schema', 'migrations', '001_admin_management_upgrade.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let hasError = false;

    for (const stmt of statements) {
      if (stmt) {
        try {
          await db.promise().query(stmt);
          const preview = stmt.substring(0, 60).replace(/\s+/g, ' ');
          console.log('✓', preview + (stmt.length > 60 ? '...' : ''));
        } catch (e) {
          if (!e.message.includes('Duplicate column')) {
            console.log('⚠️', e.message.substring(0, 100));
            hasError = true;
          }
        }
      }
    }

    if (hasError) {
      console.log('\n⚠️ Migration completed with warnings.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
