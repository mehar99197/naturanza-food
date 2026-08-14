/**
 * One-time reconciliation: give existing coupons a per-customer limit.
 *
 * Migration 027 adds coupons.per_user_limit with a NULL default on purpose, so
 * running it changes nothing about codes already in circulation. That keeps the
 * deploy safe but leaves the leak it was meant to fix (audit M-07) open on
 * exactly the coupons that are live right now — one customer can still redeem
 * them on every order they place.
 *
 * Closing that by blanket-setting every coupon to 1 would be a guess: some codes
 * really are meant to be reused by the same customer. So this script does not
 * guess. orders.coupon_code already records who redeemed what, so it asks the
 * data instead:
 *
 *   - A coupon NO customer has ever used more than once can be set to 1 without
 *     changing a single thing that has actually happened. Applied automatically.
 *   - A coupon that HAS been redeemed twice by the same customer might be
 *     deliberately repeatable. Left alone and reported, with the highest number
 *     of redemptions one customer reached, so the limit can be set knowingly.
 *
 * Cancelled orders are excluded: cancelling releases the coupon, so those
 * redemptions were handed back and do not count as reuse.
 *
 * Usage:
 *   node reconcile-coupon-limits.js            # dry run — reports, changes nothing
 *   node reconcile-coupon-limits.js --apply    # commit the safe changes
 *
 * Dry run is the default deliberately: this mutates coupon behaviour, and an
 * accidental re-run must never silently re-apply a limit an admin has since
 * cleared on purpose.
 */

const { dbPool } = require("./config/db");

const APPLY = process.argv.includes("--apply");

const run = async () => {
  console.log(
    APPLY
      ? "Reconciling per-customer coupon limits (APPLY — changes will be written)\n"
      : "Reconciling per-customer coupon limits (DRY RUN — nothing will be written)\n",
  );

  const [unlimited] = await dbPool.query(
    `SELECT id, code, description, used_count, usage_limit, is_active, expiry_date
       FROM coupons
      WHERE per_user_limit IS NULL
      ORDER BY code`,
  );

  if (unlimited.length === 0) {
    console.log("Every coupon already has a per-customer limit. Nothing to do.");
    return;
  }

  // Highest number of times any single customer redeemed each code.
  const [reuse] = await dbPool.query(
    `SELECT coupon_code, MAX(uses) AS max_uses_by_one_customer, COUNT(*) AS customers_who_reused
       FROM (
         SELECT coupon_code, user_id, COUNT(*) AS uses
           FROM orders
          WHERE coupon_code IS NOT NULL
            AND coupon_code <> ''
            AND status <> 'cancelled'
          GROUP BY coupon_code, user_id
         HAVING COUNT(*) > 1
       ) AS repeats
      GROUP BY coupon_code`,
  );

  const reuseByCode = new Map(
    reuse.map((row) => [String(row.coupon_code).toUpperCase(), row]),
  );

  const safe = [];
  const needsDecision = [];

  for (const coupon of unlimited) {
    const history = reuseByCode.get(String(coupon.code).toUpperCase());
    if (history) {
      needsDecision.push({ coupon, history });
    } else {
      safe.push(coupon);
    }
  }

  if (safe.length > 0) {
    console.log(
      `${safe.length} coupon(s) have never been redeemed twice by the same customer.`,
    );
    console.log("Setting these to 1 per customer changes nothing that has happened:\n");
    for (const coupon of safe) {
      console.log(
        `  ${String(coupon.code).padEnd(20)} used ${String(coupon.used_count || 0).padStart(4)}x` +
          `  ${coupon.is_active ? "active " : "invalid"}  ${coupon.description || ""}`.trimEnd(),
      );
    }
    console.log("");
  }

  if (needsDecision.length > 0) {
    console.log(
      `${needsDecision.length} coupon(s) HAVE been reused by the same customer — left unchanged.`,
    );
    console.log("These may be repeatable on purpose. Decide each one in admin → Coupons:\n");
    for (const { coupon, history } of needsDecision) {
      console.log(
        `  ${String(coupon.code).padEnd(20)} one customer used it ` +
          `${history.max_uses_by_one_customer}x` +
          `  (${history.customers_who_reused} customer(s) reused it)`,
      );
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write the safe changes above.");
    return;
  }

  if (safe.length === 0) {
    console.log("No safe changes to apply.");
    return;
  }

  const [result] = await dbPool.query(
    `UPDATE coupons
        SET per_user_limit = 1
      WHERE per_user_limit IS NULL
        AND id IN (${safe.map(() => "?").join(", ")})`,
    safe.map((coupon) => coupon.id),
  );

  console.log(`Applied: ${result.affectedRows} coupon(s) set to 1 per customer.`);
  if (needsDecision.length > 0) {
    console.log(
      `Still unlimited and awaiting your decision: ${needsDecision
        .map(({ coupon }) => coupon.code)
        .join(", ")}`,
    );
  }
};

run()
  .catch((error) => {
    console.error("Reconciliation failed:", error.sqlMessage || error.message);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
