const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");
const { restrictBody } = require("../middleware/security");
const { toBoolean, toNullableString } = require("../utils/helpers");
const {
  consumeReservationsOnConnection,
  releaseReservationsOnConnection,
} = require("../utils/stockReservations");
const { getAdminSettings } = require("../utils/adminSettings");
const { sendPaymentStatusEmail } = require("../utils/emailService");

const STAGE_LABELS = {
  full_payment: "Full Payment",
  advance_shipping: "Delivery Fee Advance",
  final_collection: "Cash on Delivery",
};

const insertCustomerNotification = async (conn, { userId, type, title, message, payload }) => {
  if (!Number.isInteger(userId)) return;
  try {
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, message, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, payload ? JSON.stringify(payload) : null],
    );
  } catch (notifyErr) {
    // Notifications are best-effort — never fail the approve/reject txn over them.
    console.warn("[adminPayments] customer notification insert failed:", notifyErr.message);
  }
};

const ALLOWED_VERIFICATION_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "all",
]);

const ALLOWED_VERIFICATION_STAGES = new Set([
  "full_payment",
  "advance_shipping",
  "final_collection",
  "all",
]);

// GET /api/admin/payments/analytics
// Live revenue rollups for the dashboard cards.
// Three conditional SUMs in a single round-trip — the planner scans the
// (status, created_at) index once instead of three times.
router.get("/analytics", authenticateToken, isAdmin, async (req, res) => {
  const conn = await db.promise().getConnection();
  try {
    // Pin session TZ so CURDATE() / MONTH(NOW()) align with PKT regardless of server locale.
    await conn.query("SET time_zone = '+05:00'");

    const [[row]] = await conn.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='approved' THEN amount END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status='approved' AND verification_stage='full_payment'      THEN amount END), 0) AS prepaid_revenue,
        COALESCE(SUM(CASE WHEN status='approved' AND verification_stage='advance_shipping'  THEN amount END), 0) AS cod_advance_revenue,
        COALESCE(SUM(CASE WHEN status='approved' AND verification_stage='final_collection'  THEN amount END), 0) AS cod_final_revenue,
        COALESCE(SUM(CASE
            WHEN status='approved'
             AND YEAR(created_at)  = YEAR(CURDATE())
             AND MONTH(created_at) = MONTH(CURDATE())
          THEN amount END), 0) AS month_revenue,
        COALESCE(SUM(CASE
            WHEN status='approved'
             AND created_at >= CURDATE()
             AND created_at <  CURDATE() + INTERVAL 1 DAY
          THEN amount END), 0) AS today_revenue,
        COUNT(CASE WHEN status='approved' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN status='pending'  THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status='rejected' THEN 1 END) AS rejected_count,
        COUNT(CASE WHEN status='pending' AND verification_stage='final_collection' THEN 1 END) AS pending_cod_collections
      FROM advance_payment_verifications
    `);

    return res.json({
      success: true,
      currency: "PKR",
      total_revenue: Number(row.total_revenue) || 0,
      prepaid_revenue: Number(row.prepaid_revenue) || 0,
      cod_advance_revenue: Number(row.cod_advance_revenue) || 0,
      cod_final_revenue: Number(row.cod_final_revenue) || 0,
      month_revenue: Number(row.month_revenue) || 0,
      today_revenue: Number(row.today_revenue) || 0,
      approved_count: Number(row.approved_count) || 0,
      pending_count: Number(row.pending_count) || 0,
      rejected_count: Number(row.rejected_count) || 0,
      pending_cod_collections: Number(row.pending_cod_collections) || 0,
      as_of: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to compute analytics" });
  } finally {
    conn.release();
  }
});

// GET /api/admin/payments/accounts
router.get("/accounts", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT id, type, account_number, account_name, is_active, updated_at
         FROM payment_accounts
         ORDER BY FIELD(type, 'jazzcash', 'easypaisa', 'bank'), id`,
      );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch payment accounts" });
  }
});

// PUT /api/admin/payments/accounts/:id
router.put(
  "/accounts/:id",
  authenticateToken,
  isAdmin,
  requireSuperAdmin,
  restrictBody("account_number", "account_name", "is_active"),
  async (req, res) => {
    try {
      const accountId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        return res.status(400).json({ error: "Invalid account id" });
      }

      const accountNumber = toNullableString(req.body.account_number);
      const accountName = toNullableString(req.body.account_name);
      const isActive = toBoolean(req.body.is_active, true);

      if (!accountNumber || !accountName) {
        return res
          .status(400)
          .json({ error: "Account number and name are required" });
      }

      const [result] = await db
        .promise()
        .query(
          `UPDATE payment_accounts
           SET account_number = ?, account_name = ?, is_active = ?
           WHERE id = ?`,
          [accountNumber, accountName, isActive, accountId],
        );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Account not found" });
      }

      const [rows] = await db
        .promise()
        .query(
          `SELECT id, type, account_number, account_name, is_active, updated_at
           FROM payment_accounts
           WHERE id = ?`,
          [accountId],
        );

      return res.json(rows[0]);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update payment account" });
    }
  },
);

// GET /api/admin/payments/verifications
router.get(
  "/verifications",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const statusParam = String(req.query.status || "pending")
        .trim()
        .toLowerCase();
      const stageParam = String(req.query.stage || "all")
        .trim()
        .toLowerCase();

      if (!ALLOWED_VERIFICATION_STATUSES.has(statusParam)) {
        return res.status(400).json({ error: "Invalid status filter" });
      }

      if (!ALLOWED_VERIFICATION_STAGES.has(stageParam)) {
        return res.status(400).json({ error: "Invalid stage filter" });
      }

      const filters = [];
      const params = [];

      if (statusParam !== "all") {
        filters.push("v.status = ?");
        params.push(statusParam);
      }

      if (stageParam !== "all") {
        filters.push("v.verification_stage = ?");
        params.push(stageParam);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const [rows] = await db
        .promise()
        .query(
          `SELECT v.id, v.order_id, v.customer_name, v.customer_phone, v.amount,
                  v.payment_method, v.verification_stage, v.transaction_id,
                  v.screenshot_url, v.status, v.rejection_reason, v.admin_note,
                  v.verified_by, v.verified_at, v.created_at,
                  u.name AS verified_by_name,
                  o.total_amount AS order_total, o.shipping_cost,
                  o.payment_method AS order_payment_method
           FROM advance_payment_verifications v
           LEFT JOIN users u ON v.verified_by = u.id
           LEFT JOIN orders o ON v.order_id = o.id
           ${whereClause}
           ORDER BY v.created_at DESC`,
          params,
        );

      return res.json(rows);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to fetch payment verifications" });
    }
  },
);

// PUT /api/admin/payments/verifications/:id/approve
router.put(
  "/verifications/:id/approve",
  authenticateToken,
  isAdmin,
  restrictBody("admin_note"),
  async (req, res) => {
    const verificationId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(verificationId) || verificationId <= 0) {
      return res.status(400).json({ error: "Invalid verification id" });
    }

    const adminNote = toNullableString(req.body.admin_note);

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      // Lock + load the verification row first so the rest of the txn can
      // branch on verification_stage.
      const [[existing]] = await conn.query(
        `SELECT id, CAST(order_id AS UNSIGNED) AS order_id, verification_stage, status
           FROM advance_payment_verifications
          WHERE id = ?
          FOR UPDATE`,
        [verificationId],
      );

      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ error: "Verification not found" });
      }

      const stage = String(existing.verification_stage || "full_payment");
      const orderId = existing.order_id || null;

      const [upd] = await conn.query(
        `UPDATE advance_payment_verifications
           SET status = 'approved', verified_by = ?, verified_at = NOW(),
               rejection_reason = NULL,
               admin_note = COALESCE(?, admin_note)
         WHERE id = ?`,
        [req.user.id, adminNote, verificationId],
      );

      if (upd.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Verification not found" });
      }

      // Decide what to do to the order based on which stage we just approved.
      //   full_payment      → flip order to 'paid' (single-shot prepaid flow)
      //   advance_shipping  → flip order to 'partial' (COD stage 1: warehouse can ship)
      //   final_collection  → flip order to 'paid' (COD stage 2: rider returned cash)
      const nextOrderPaymentStatus =
        stage === "advance_shipping" ? "partial" : "paid";

      await conn.query(
        `UPDATE orders o
           JOIN advance_payment_verifications v
             ON CAST(v.order_id AS UNSIGNED) = o.id
            SET o.payment_status = ?
          WHERE v.id = ?`,
        [nextOrderPaymentStatus, verificationId],
      );

      // Mirror TID onto the order — best-effort, only applicable to stages
      // that actually have a TID (full_payment + advance_shipping). Skip for
      // final_collection (cash, no TID). Tolerate missing column (migration 011).
      if (stage !== "final_collection") {
        try {
          await conn.query(
            `UPDATE orders o
               JOIN advance_payment_verifications v
                 ON CAST(v.order_id AS UNSIGNED) = o.id
                SET o.transaction_id = COALESCE(v.transaction_id, o.transaction_id)
              WHERE v.id = ?`,
            [verificationId],
          );
        } catch (mirrorErr) {
          if (mirrorErr?.errno !== 1054) throw mirrorErr;
          console.warn(
            "[adminPayments] transaction_id mirror skipped — column missing. Run migration 011_add_transaction_id.sql.",
          );
        }
      }

      // Stock reservation rules:
      //   full_payment      → consume on approve (existing prepaid behavior)
      //   advance_shipping  → consume on approve so warehouse can ship
      //   final_collection  → NO-OP (stock was already consumed at stage 1)
      if (stage !== "final_collection" && orderId) {
        await consumeReservationsOnConnection(conn, orderId);
      }

      // When stage-1 (advance_shipping) is approved, create the matching
      // stage-2 (final_collection) row so admin can later confirm the cash
      // collected at delivery. Without this, the "COD Final Pending" tab
      // stays empty and the COD flow can never close out.
      // Idempotent via uq_apv_order_stage (order_id + verification_stage).
      if (stage === "advance_shipping" && orderId) {
        const [[orderRow]] = await conn.query(
          `SELECT customer_name, customer_email, phone,
                  subtotal, discount_amount, shipping_cost, total_amount
             FROM orders WHERE id = ? LIMIT 1`,
          [orderId],
        );

        if (orderRow) {
          const remainingCod = Math.max(
            0,
            Math.round(
              Number(orderRow.total_amount || 0) - Number(orderRow.shipping_cost || 0),
            ),
          );

          if (remainingCod > 0) {
            await conn.query(
              `INSERT INTO advance_payment_verifications
                 (order_id, customer_name, customer_phone, amount, payment_method,
                  verification_stage, transaction_id, screenshot_url, status)
               VALUES (?, ?, ?, ?, 'cod', 'final_collection', NULL, NULL, 'pending')
               ON DUPLICATE KEY UPDATE id = id`,
              [
                String(orderId),
                orderRow.customer_name || "",
                orderRow.phone || null,
                remainingCod,
              ],
            );
          }
        }
      }

      // Notify the customer: in-app notification + transactional email.
      // Notification is inserted inside the txn (atomic with approval).
      // Email is fired AFTER commit so a slow SMTP can't block the response.
      let customerEmailCtx = null;
      if (orderId) {
        const [[customerRow]] = await conn.query(
          `SELECT o.user_id, o.customer_name, o.customer_email,
                  v.amount AS approved_amount
             FROM orders o
             JOIN advance_payment_verifications v ON CAST(v.order_id AS UNSIGNED) = o.id
            WHERE v.id = ?
            LIMIT 1`,
          [verificationId],
        );

        if (customerRow) {
          const stageLabel = STAGE_LABELS[stage] || "Payment";
          const notifTitle = "Payment Approved";
          const notifMessage = `Your ${stageLabel} for Order #${orderId} has been approved.`;
          await insertCustomerNotification(conn, {
            userId: customerRow.user_id,
            type: "payment_approved",
            title: notifTitle,
            message: notifMessage,
            payload: {
              order_id: orderId,
              verification_id: verificationId,
              verification_stage: stage,
              amount: Number(customerRow.approved_amount) || 0,
            },
          });

          customerEmailCtx = {
            email: customerRow.customer_email,
            customerName: customerRow.customer_name,
            amount: Number(customerRow.approved_amount) || 0,
            stageLabel,
          };
        }
      }

      await conn.commit();

      // Fire-and-forget email after commit so SMTP latency doesn't block response.
      if (customerEmailCtx?.email) {
        setImmediate(async () => {
          try {
            const settings = await getAdminSettings();
            await sendPaymentStatusEmail({
              email: customerEmailCtx.email,
              storeName: settings.storeName,
              customerName: customerEmailCtx.customerName,
              orderId,
              amount: customerEmailCtx.amount,
              currency: settings.currency,
              stageLabel: customerEmailCtx.stageLabel,
              isApproved: true,
            });
          } catch (emailErr) {
            console.warn("[adminPayments] approval email failed:", emailErr.message);
          }
        });
      }

      // Fetch the freshly approved verification. Try with transaction_id first;
      // fall back to a column-free SELECT for DBs missing migration 011.
      const fetchSql = (includeTxId) => `
        SELECT v.id, v.order_id, v.customer_name, v.customer_phone, v.amount,
               v.payment_method, v.verification_stage,
               ${includeTxId ? "v.transaction_id," : ""} v.screenshot_url, v.status,
               v.rejection_reason, v.admin_note,
               v.verified_by, v.verified_at, v.created_at,
               u.name AS verified_by_name,
               o.total_amount AS order_total, o.shipping_cost,
               o.payment_method AS order_payment_method
          FROM advance_payment_verifications v
          LEFT JOIN users u ON v.verified_by = u.id
          LEFT JOIN orders o ON CAST(v.order_id AS UNSIGNED) = o.id
         WHERE v.id = ?`;

      let rows;
      try {
        [rows] = await conn.query(fetchSql(true), [verificationId]);
      } catch (selErr) {
        if (selErr?.errno !== 1054) throw selErr;
        [rows] = await conn.query(fetchSql(false), [verificationId]);
      }

      return res.json({
        message: "Verification approved",
        verification: rows[0] || null,
      });
    } catch (error) {
      try { await conn.rollback(); } catch {}
      if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
        return res.status(409).json({
          success: false,
          message: "This Transaction ID is already linked to another order.",
        });
      }
      console.error("[adminPayments] approve failed", {
        verificationId,
        code: error?.code,
        errno: error?.errno,
        sqlMessage: error?.sqlMessage,
        message: error?.message,
      });
      return res.status(500).json({
        error: "Failed to approve payment verification",
        code: error?.code,
        details: error?.sqlMessage || error?.message,
      });
    } finally {
      conn.release();
    }
  },
);

// PUT /api/admin/payments/verifications/:id/reject
router.put(
  "/verifications/:id/reject",
  authenticateToken,
  isAdmin,
  restrictBody("reason"),
  async (req, res) => {
    const verificationId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(verificationId) || verificationId <= 0) {
      return res.status(400).json({ error: "Invalid verification id" });
    }

    const reason = toNullableString(req.body.reason);
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      const [[existing]] = await conn.query(
        `SELECT id, CAST(order_id AS UNSIGNED) AS order_id, verification_stage
           FROM advance_payment_verifications
          WHERE id = ?
          FOR UPDATE`,
        [verificationId],
      );

      if (!existing) {
        await conn.rollback();
        return res.status(404).json({ error: "Verification not found" });
      }

      const stage = String(existing.verification_stage || "full_payment");
      const orderId = existing.order_id || null;

      const [result] = await conn.query(
        `UPDATE advance_payment_verifications
           SET status = 'rejected', verified_by = ?, verified_at = NOW(), rejection_reason = ?
         WHERE id = ?`,
        [req.user.id, reason, verificationId],
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Verification not found" });
      }

      // Reservation handling by stage:
      //   full_payment / advance_shipping → return held stock to pool
      //   final_collection                → NO-OP (order was physically delivered;
      //                                     stock is gone). Also mark the order
      //                                     payment_status='failed' so reports can
      //                                     surface uncollected-cash orders.
      if (stage === "final_collection") {
        await conn.query(
          `UPDATE orders o
             JOIN advance_payment_verifications v
               ON CAST(v.order_id AS UNSIGNED) = o.id
              SET o.payment_status = 'failed'
            WHERE v.id = ?`,
          [verificationId],
        );
      } else if (orderId) {
        await releaseReservationsOnConnection(conn, orderId);
      }

      // Notify the customer (in-app + email) the same way the approve path does.
      let customerEmailCtx = null;
      if (orderId) {
        const [[customerRow]] = await conn.query(
          `SELECT o.user_id, o.customer_name, o.customer_email,
                  v.amount AS rejected_amount
             FROM orders o
             JOIN advance_payment_verifications v ON CAST(v.order_id AS UNSIGNED) = o.id
            WHERE v.id = ?
            LIMIT 1`,
          [verificationId],
        );

        if (customerRow) {
          const stageLabel = STAGE_LABELS[stage] || "Payment";
          await insertCustomerNotification(conn, {
            userId: customerRow.user_id,
            type: "payment_rejected",
            title: "Payment Could Not Be Verified",
            message: `Your ${stageLabel} for Order #${orderId} was rejected. Reason: ${reason}`,
            payload: {
              order_id: orderId,
              verification_id: verificationId,
              verification_stage: stage,
              amount: Number(customerRow.rejected_amount) || 0,
              reason,
            },
          });

          customerEmailCtx = {
            email: customerRow.customer_email,
            customerName: customerRow.customer_name,
            amount: Number(customerRow.rejected_amount) || 0,
            stageLabel,
          };
        }
      }

      await conn.commit();

      if (customerEmailCtx?.email) {
        setImmediate(async () => {
          try {
            const settings = await getAdminSettings();
            await sendPaymentStatusEmail({
              email: customerEmailCtx.email,
              storeName: settings.storeName,
              customerName: customerEmailCtx.customerName,
              orderId,
              amount: customerEmailCtx.amount,
              currency: settings.currency,
              stageLabel: customerEmailCtx.stageLabel,
              isApproved: false,
              rejectionReason: reason,
            });
          } catch (emailErr) {
            console.warn("[adminPayments] rejection email failed:", emailErr.message);
          }
        });
      }

      const [rows] = await conn.query(
        `SELECT v.id, v.order_id, v.customer_name, v.customer_phone, v.amount,
                v.payment_method, v.verification_stage, v.transaction_id,
                v.screenshot_url, v.status, v.rejection_reason, v.admin_note,
                v.verified_by, v.verified_at, v.created_at,
                u.name AS verified_by_name,
                o.total_amount AS order_total, o.shipping_cost,
                o.payment_method AS order_payment_method
           FROM advance_payment_verifications v
           LEFT JOIN users u ON v.verified_by = u.id
           LEFT JOIN orders o ON v.order_id = o.id
          WHERE v.id = ?`,
        [verificationId],
      );

      return res.json({
        message: "Verification rejected",
        verification: rows[0] || null,
      });
    } catch (error) {
      try { await conn.rollback(); } catch {}
      console.error("[adminPayments] reject failed", {
        verificationId,
        code: error?.code,
        errno: error?.errno,
        sqlMessage: error?.sqlMessage,
        message: error?.message,
      });
      return res.status(500).json({
        error: "Failed to reject payment verification",
        code: error?.code,
        details: error?.sqlMessage || error?.message,
      });
    } finally {
      conn.release();
    }
  },
);

module.exports = router;
