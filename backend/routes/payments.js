const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const { toNullableString } = require("../utils/helpers");
const { uploadAndCompress } = require("../middleware/upload");

const ALLOWED_PAYMENT_METHODS = new Set(["jazzcash", "easypaisa", "bank"]);
const WALLET_METHODS = new Set(["jazzcash", "easypaisa"]);
const TID_REGEX = /^\d{11}$/;

// GET /api/payments/accounts/active (public - no auth required for checkout)
router.get("/accounts/active", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT id, type, account_number, account_name
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
      const screenshotUrl =
        toNullableString(req.body.screenshot_url) || req.file?.url || null;

      const rawTid = toNullableString(req.body.transaction_id);
      const transactionId = rawTid ? rawTid.replace(/\D/g, "").slice(0, 11) : null;

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
      if (order.user_id !== req.user.id && req.user.role !== "admin") {
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

      const [result] = await db
        .promise()
        .query(
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

      return res.status(201).json({
        success: true,
        message: "Verification submitted successfully",
        id: result.insertId,
        verification_stage: verificationStage,
        amount: enforcedAmount,
      });
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
