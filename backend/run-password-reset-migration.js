/**
 * Migration Script: Add password_reset_tokens table
 * Run this script to create the password reset tokens table in the database
 */

const fs = require("fs");
const path = require("path");
const { dbPool } = require("./config/db");

const runMigration = async () => {
  console.log("🔄 Running password reset tokens migration...\n");

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      "schema",
      "migrations",
      "add_password_reset_tokens.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    // Execute each statement
    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`📝 Executing: ${statement.substring(0, 60)}...`);
        await dbPool.query(statement);
        console.log("   ✅ Success\n");
      }
    }

    console.log("✅ Migration completed successfully!");
    console.log("📋 Table 'password_reset_tokens' is now available.\n");

    // Verify table exists
    const [tables] = await dbPool.query(
      "SHOW TABLES LIKE 'password_reset_tokens'"
    );
    if (tables.length > 0) {
      console.log("✅ Verification: Table exists in database.");
      
      // Show table structure
      const [columns] = await dbPool.query(
        "DESCRIBE password_reset_tokens"
      );
      console.log("\n📊 Table Structure:");
      columns.forEach((col) => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === "NO" ? "NOT NULL" : ""}`);
      });
    }
  } catch (error) {
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("ℹ️  Table 'password_reset_tokens' already exists. Skipping creation.");
    } else {
      console.error("❌ Migration failed:", error.message);
      process.exit(1);
    }
  } finally {
    await dbPool.end();
    process.exit(0);
  }
};

runMigration();
