const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const { toNullableString } = require("../utils/helpers");
const { uploadAndCompress } = require("../middleware/upload");

const ALLOWED_PAYMENT_METHODS = new Set(["jazzcash", "easypaisa", "bank"]);
const WALLET_METHODS = new Set(["jazzcash", "easypaisa"]);
const CHECKOUT_PAYMENT_METHODS = new Set(["cod", "easypaisa", "jazzcash", "bank"]);
const DEFAULT_CHECKOUT_METHODS = [
  { code: "cod", label: "Cash on Delivery", description: "Cash collection at delivery", sort_order: 1 },
  { code: "easypaisa", label: "EasyPaisa", description: "EasyPaisa wallet payments", sort_order: 4 },
  { code: "jazzcash", label: "JazzCash", description: "JazzCash wallet payments", sort_order: 5 },
  { code: "bank", label: "Bank Transfer", description: "Manual bank transfer", sort_order: 6 },
];
const TID_REGEX = /^\d{11}$/;

// Keep the checkout's choices aligned with the methods enforced by orders.js.
router.get("/methods/active", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT code, label, description, sort_order, supports_online
         FROM payment_methods
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, created_at ASC`,
    );

    // An older database may not have been seeded yet. Preserve the same
    // fallback as order creation in that case, while ignoring unsupported
    // gateway methods that cannot complete checkout.
    if (rows.length === 0) {
      return res.json(DEFAULT_CHECKOUT_METHODS);
    }

    const checkoutMethods = rows.filter((row) =>
      CHECKOUT_PAYMENT_METHODS.has(String(row.code || "").trim().toLowerCase()),
    );
    if (!checkoutMethods.some((row) => String(row.code || "").trim().toLowerCase() === "cod")) {
      checkoutMethods.unshift(DEFAULT_CHECKOUT_METHODS[0]);
    }

    return res.json(checkoutMethods);
  } catch (error) {
    return res.json(DEFAULT_CHECKOUT_METHODS);
  }
});

// Checkout is authenticated, so keep receiving account details off the public
// internet and out of unauthenticated catalog scraping.
router.get("/accounts/active", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT type, account_number, account_name
         FROM payment_accounts
         WHERE is_active = TRUE
         ORDER BY FIELD(type, 'jazzcash', 'easypaisa', 'bank'), id`,
      );

    return res.json(rows);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to fetch active payment accounts" });
  }
});

// POST /api/payments/submit-verification
router.post(
  "/submit-verification",
  authenticateToken,
  uploadAndCompress("verification_screenshot", "payment-verifications", {
    width: 900,
    height: 900,
    quality: 82,
    fit: "inside",
  }),
  restrictBody(
    "order_id",
    "customer_name",
    "customer_phone",
    "amount",
    "payment_method",
    "screenshot_url",
    "transaction_id",
    "verification_screenshot",
  ),
  async (req, res) => {
    try {
      const orderId = String(req.body.order_id || "").trim();
      const customerName = String(req.body.customer_name || "").trim();
      const customerPhone = toNullableString(req.body.customer_phone);
      const paymentMethod = String(req.body.payment_method || "")
        .trim()
        .toLowerCase();
      // Never trust a client-supplied URL for a payment document. Only the
      // file processed by this request may become the stored screenshot path.
      const screenshotUrl = req.file?.url || null;

      const rawTid = toNullableString(req.body.transaction_id);
      const transactionId = rawTid ? rawTid.replace(/[\s-]/g, "") : null;

      if (!orderId || !customerName) {
        return res
          .status(400)
          .json({ success: false, message: "Order id and customer name are required" });
      }

      if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        return res.status(400).json({ success: false, message: "Invalid payment method" });
      }

      if (!screenshotUrl) {
        return res.status(400).json({ success: false, message: "Screenshot is required" });
      }

      if (WALLET_METHODS.has(paymentMethod) && (!transactionId || !TID_REGEX.test(transactionId))) {
        return res.status(400).json({
          success: false,
          message: "A valid 11-digit Transaction ID is required for JazzCash/EasyPaisa.",
        });
      }

      // Derive verification_stage + authoritative amount from the order itself.
      // Customer-supplied amount is ignored — for COD the stage-1 amount must
      // equal shipping_cost; for prepaid it must equal total_amount.
      const [[order]] = await db.promise().query(
        `SELECT user_id, payment_method AS order_payment_method, total_amount, shipping_cost
           FROM orders
          WHERE id = ?`,
        [Number(orderId)],
      );

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // Ownership: a customer may only submit verification for their own order.
      const adminPermissions = Array.isArray(req.user.admin_permissions)
        ? req.user.admin_permissions.map((value) => String(value).trim())
        : [];
      const canManagePayments =
        String(req.user.role || "").toLowerCase() === "admin" &&
        (String(req.user.admin_role || "").toLowerCase() === "super_admin" ||
          adminPermissions.includes("manage_payments"));
      if (order.user_id !== req.user.id && !canManagePayments) {
        return res.status(403).json({ success: false, message: "You do not have access to this order" });
      }

      const isCodOrder = String(order.order_payment_method || "").toLowerCase() === "cod";
      const verificationStage = isCodOrder ? "advance_shipping" : "full_payment";
      const enforcedAmount = isCodOrder
        ? Number(order.shipping_cost)
        : Number(order.total_amount);

      if (!Number.isFinite(enforcedAmount) || enforcedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: isCodOrder
            ? "Order has no shipping fee configured; cannot create advance verification."
            : "Order total is invalid; cannot create verification.",
        });
      }

      const connection = await db.promise().getConnection();
      try {
        await connection.beginTransaction();
        const [[existing]] = await connection.query(
          `SELECT id, status
             FROM advance_payment_verifications
            WHERE order_id = ? AND verification_stage = ?
            FOR UPDATE`,
          [orderId, verificationStage],
        );

        let verificationId;
        if (existing) {
          if (String(existing.status).toLowerCase() !== "rejected") {
            await connection.rollback();
            return res.status(409).json({
              success: false,
              message: "A verification for this stage is already pending or approved.",
            });
          }

          const [updated] = await connection.query(
            `UPDATE advance_payment_verifications
                SET customer_name = ?, customer_phone = ?, amount = ?,
                    payment_method = ?, transaction_id = ?, screenshot_url = ?,
                    status = 'pending', rejection_reason = NULL,
                    admin_note = NULL, verified_by = NULL, verified_at = NULL,
                    created_at = CURRENT_TIMESTAMP
              WHERE id = ? AND status = 'rejected'`,
            [
              customerName,
              customerPhone,
              enforcedAmount,
              paymentMethod,
              transactionId,
              screenshotUrl,
              existing.id,
            ],
          );
          if (updated.affectedRows !== 1) {
            await connection.rollback();
            return res.status(409).json({
              success: false,
              message: "This verification was changed by another request.",
            });
          }
          verificationId = existing.id;
        } else {
          const [inserted] = await connection.query(
            `INSERT INTO advance_payment_verifications
             (order_id, customer_name, customer_phone, amount, payment_method,
              verification_stage, transaction_id, screenshot_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
              orderId,
              customerName,
              customerPhone,
              enforcedAmount,
              paymentMethod,
              verificationStage,
              transactionId,
              screenshotUrl,
            ],
          );
          verificationId = inserted.insertId;
        }
        await connection.commit();

        return res.status(existing ? 200 : 201).json({
          success: true,
          message: existing
            ? "Verification resubmitted successfully"
            : "Verification submitted successfully",
          id: verificationId,
          verification_stage: verificationStage,
          amount: enforcedAmount,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
        // Distinguish duplicate-stage (uq_apv_order_stage) from duplicate-TID
        // (uq_apv_transaction_id) using the constraint name in sqlMessage.
        const sqlMsg = String(error.sqlMessage || "");
        if (sqlMsg.includes("uq_apv_order_stage")) {
          return res.status(409).json({
            success: false,
            message: "A verification for this stage has already been submitted for this order.",
          });
        }
        return res.status(400).json({
          success: false,
          message: "This Transaction ID has already been verified or used for another order.",
        });
      }
      console.error("[payments] submit-verification failed", {
        code: error?.code,
        errno: error?.errno,
        sqlMessage: error?.sqlMessage,
        message: error?.message,
      });
      return res
        .status(500)
        .json({ success: false, message: "Failed to submit payment verification" });
    }
  },
);

module.exports = router;
