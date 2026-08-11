/**
 * Migration Script: 025_add_admin_security_center
 * Adds admin TOTP 2FA columns, super-admin IP allowlist table, session
 * metadata columns, and richer admin audit-log columns. Idempotent.
 * Run once:  node run-admin-security-migration.js
 */
const fs = require("fs");
const path = require("path");
const { db } = require("./config/db");

(async () => {
  const migrationPath = path.join(
    __dirname,
    "schema",
    "migrations",
    "025_add_admin_security_center.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  let hasError = false;

  for (const statement of statements) {
    try {
      await db.promise().query(statement);
      const preview = statement.substring(0, 70).replace(/\s+/g, " ");
      console.log("✓", preview + (statement.length > 70 ? "..." : ""));
    } catch (error) {
      const benign =
        error.message.includes("Duplicate column") ||
        error.message.includes("Duplicate key") ||
        error.message.includes("already exists");
      if (!benign) {
        console.log("⚠️", error.message.substring(0, 140));
        hasError = true;
      }
    }
  }

  if (hasError) {
    console.log("\n⚠️ Migration completed with warnings.");
    process.exit(1);
  }

  console.log("\n✅ Admin security migration completed successfully!");
  process.exit(0);
})().catch((error) => {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
});
