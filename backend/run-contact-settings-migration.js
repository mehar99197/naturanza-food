/**
 * Migration Script: 014_extend_admin_settings_contact
 * Adds contact/social/map/whatsapp columns to admin_settings so the user-side
 * Contact page can be managed from the admin dashboard.
 */

const fs = require("fs");
const path = require("path");
const { dbPool } = require("./config/db");

const runMigration = async () => {
  console.log("🔄 Running admin_settings contact-fields migration (014)...\n");

  try {
    const migrationPath = path.join(
      __dirname,
      "schema",
      "migrations",
      "014_extend_admin_settings_contact.sql"
    );
    const rawSQL = fs.readFileSync(migrationPath, "utf8");

    // Strip `-- ...` line comments before splitting on `;` so semicolons inside
    // comments do not chop a single ALTER statement into pieces.
    const migrationSQL = rawSQL
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        console.log(`📝 Executing: ${statement.substring(0, 70).replace(/\s+/g, " ")}...`);
        await dbPool.query(statement);
        console.log("   ✅ Success\n");
      } catch (error) {
        if (error.code === "ER_DUP_FIELDNAME") {
          console.log("   ℹ️  Column already exists, skipping.\n");
        } else {
          throw error;
        }
      }
    }

    console.log("✅ Migration 014 completed successfully!\n");

    const [columns] = await dbPool.query("DESCRIBE admin_settings");
    console.log("📊 admin_settings columns:");
    columns.forEach((col) => {
      console.log(`   - ${col.Field}: ${col.Type}`);
    });
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
};

runMigration();
