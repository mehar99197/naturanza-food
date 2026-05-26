/**
 * Migration Script: 015_add_newsletter_subscribers
 * Creates newsletter_subscribers table + welcome promo code column on
 * admin_settings.
 */

const fs = require("fs");
const path = require("path");
const { dbPool } = require("./config/db");

const runMigration = async () => {
  console.log("🔄 Running newsletter subscribers migration (015)...\n");

  try {
    const migrationPath = path.join(
      __dirname,
      "schema",
      "migrations",
      "015_add_newsletter_subscribers.sql"
    );
    const rawSQL = fs.readFileSync(migrationPath, "utf8");

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
        if (error.code === "ER_DUP_FIELDNAME" || error.code === "ER_TABLE_EXISTS_ERROR") {
          console.log(`   ℹ️  Already exists (${error.code}), skipping.\n`);
        } else {
          throw error;
        }
      }
    }

    console.log("✅ Migration 015 completed successfully!\n");

    const [subscribers] = await dbPool.query("DESCRIBE newsletter_subscribers");
    console.log("📊 newsletter_subscribers columns:");
    subscribers.forEach((col) => console.log(`   - ${col.Field}: ${col.Type}`));
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
};

runMigration();
