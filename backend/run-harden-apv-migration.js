/**
 * Migration Script: 016_harden_advance_payment_verifications
 * Promotes advance_payment_verifications to a properly-typed table with FK
 * cascade — fixes orphaned-row drift and currency-precision loss.
 */

const fs = require("fs");
const path = require("path");
const { dbPool } = require("./config/db");

const runMigration = async () => {
  console.log("🔄 Running harden APV migration (016)...\n");

  try {
    const rawSQL = fs.readFileSync(
      path.join(__dirname, "schema", "migrations", "016_harden_advance_payment_verifications.sql"),
      "utf8",
    );

    // Strip `-- ...` line comments before splitting on `;` so semicolons in
    // comments don't chop a single statement into pieces.
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
        console.log(`📝 Executing: ${statement.substring(0, 80).replace(/\s+/g, " ")}...`);
        await dbPool.query(statement);
        console.log("   ✅ Success\n");
      } catch (error) {
        // Idempotency: FK already exists, column already the target type, etc.
        if (
          error.code === "ER_FK_DUP_NAME" ||
          error.errno === 1826 ||
          error.code === "ER_DUP_KEYNAME"
        ) {
          console.log("   ℹ️  FK already exists, skipping.\n");
        } else {
          throw error;
        }
      }
    }

    console.log("✅ Migration 016 completed.\n");

    const [cols] = await dbPool.query("DESCRIBE advance_payment_verifications");
    console.log("📊 advance_payment_verifications columns:");
    cols.forEach((c) => console.log(`   - ${c.Field}: ${c.Type}`));

    const [[fk]] = await dbPool.query(
      `SELECT COUNT(*) AS c FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'advance_payment_verifications'
          AND CONSTRAINT_NAME = 'fk_apv_order'`,
    );
    console.log(`\nFK fk_apv_order present: ${fk.c > 0 ? "✅" : "❌"}`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
};

runMigration();
