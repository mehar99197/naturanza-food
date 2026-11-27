const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { restrictBody } = require("../middleware/security");
const { toNullableString } = require("../utils/helpers");
const { getAdminSettings } = require("../utils/adminSettings");
const { sendPaymentStatusEmail } = require("../utils/emailService");
const { getPublicSafepayStatus } = require("../utils/safepay");
const { logAdminAction, getClientIP } = require("../utils/adminHelpers");

const ALLOWED_TX_STATUSES = new Set([
  "all",
  "pending",
  "partial",
  "paid",
  "failed",
  "refunded",
  "cancelled",
]);

const ALLOWED_PROVIDERS = new Set(["all", "safepay", "cod"]);

// GET /api/admin/payments/gateway-status
router.get(
  "/gateway-status",
  authenticateToken,
  isAdmin,
  requirePermission("manage_payments"),
  (req, res) => {
    return res.json({
      success: true,
      gateway: "safepay",
      ...getPublicSafepayStatus(),
    });
  },
);

// GET /api/admin/payments/analytics
// Live revenue rollups computed directly from payment_transactions + orders in PKT.
router.get(
  "/analytics",
  authenticateToken,
  isAdmin,
  requirePermission("manage_payments"),
  async (req, res) => {
    const conn = await db.promise().getConnection();
    try {
      await conn.query("SET time_zone = '+05:00'");

      const [[txRow]] = await conn.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' AND transaction_type = 'payment' THEN amount END), 0) AS total_revenue,
          COALESCE(SUM(CASE WHEN status = 'paid' AND transaction_type = 'payment' AND provider = 'safepay' AND (payload IS NULL OR payload NOT LIKE '%"advance_shipping"%') THEN amount END), 0) AS safepay_full_revenue,
          COALESCE(SUM(CASE WHEN status = 'paid' AND transaction_type = 'payment' AND provider = 'safepay' AND payload LIKE '%"advance_shipping"%' THEN amount END), 0) AS cod_advance_revenue,
          COALESCE(SUM(CASE WHEN status = 'paid' AND transaction_type = 'payment' AND provider = 'cod' THEN amount END), 0) AS cod_final_revenue,
          COALESCE(SUM(CASE
            WHEN status = 'paid' AND transaction_type = 'payment'
             AND YEAR(COALESCE(processed_at, created_at)) = YEAR(CURDATE())
             AND MONTH(COALESCE(processed_at, created_at)) = MONTH(CURDATE())
            THEN amount END), 0) AS month_revenue,
          COALESCE(SUM(CASE
            WHEN status = 'paid' AND transaction_type = 'payment'
             AND COALESCE(processed_at, created_at) >= CURDATE()
             AND COALESCE(processed_at, created_at) < CURDATE() + INTERVAL 1 DAY
            THEN amount END), 0) AS today_revenue,
          COUNT(CASE WHEN status = 'paid' AND transaction_type = 'payment' THEN 1 END) AS paid_count,
          COUNT(CASE WHEN status = 'pending' AND transaction_type = 'payment' THEN 1 END) AS pending_count,
          COUNT(CASE WHEN status IN ('failed', 'cancelled') AND transaction_type = 'payment' THEN 1 END) AS failed_count
        FROM payment_transactions
      `);

      const [[codRow]] = await conn.query(`
        SELECT
          COUNT(*) AS pending_cod_collections,
          COALESCE(SUM(
            CASE
              WHEN payment_status = 'partial' THEN GREATEST(0, total_amount - shipping_cost)
              ELSE total_amount
            END
          ), 0) AS pending_cod_amount
        FROM orders
        WHERE payment_method = 'cod'
          AND status <> 'cancelled'
          AND payment_status IN ('pending', 'partial')
      `);

      const settings = await getAdminSettings().catch(() => ({ currency: "PKR" }));
      const currency = settings.currency || "PKR";

      return res.json({
        success: true,
        currency,
        total_revenue: Number(txRow.total_revenue) || 0,
        prepaid_revenue: Number(txRow.safepay_full_revenue) || 0,
        safepay_revenue:
          (Number(txRow.safepay_full_revenue) || 0) +
          (Number(txRow.cod_advance_revenue) || 0),
        cod_advance_revenue: Number(txRow.cod_advance_revenue) || 0,
        cod_final_revenue: Number(txRow.cod_final_revenue) || 0,
        month_revenue: Number(txRow.month_revenue) || 0,
        today_revenue: Number(txRow.today_revenue) || 0,
        approved_count: Number(txRow.paid_count) || 0,
        pending_count: Number(txRow.pending_count) || 0,
        rejected_count: Number(txRow.failed_count) || 0,
        pending_cod_collections: Number(codRow.pending_cod_collections) || 0,
        pending_cod_amount: Number(codRow.pending_cod_amount) || 0,
        as_of: new Date().toISOString(),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to compute payment analytics" });
    } finally {
      await conn.query("SET time_zone = DEFAULT").catch(() => {});
      conn.release();
    }
  },
);

// GET /api/admin/payments/transactions
router.get(
  "/transactions",
  authenticateToken,
  isAdmin,
  requirePermission("manage_payments"),
  async (req, res) => {
    try {
      const statusParam = String(req.query.status || "all").trim().toLowerCase();
      const providerParam = String(req.query.provider || "all").trim().toLowerCase();
      const searchParam = String(req.query.search || "").trim();
      const limitRaw = Number.parseInt(req.query.limit, 10);
      const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

      if (!ALLOWED_TX_STATUSES.has(statusParam)) {
        return res.status(400).json({ error: "Invalid status filter" });
      }
      if (!ALLOWED_PROVIDERS.has(providerParam)) {
        return res.status(400).json({ error: "Invalid provider filter" });
      }

      const filters = [];
      const params = [];

      if (statusParam !== "all") {
        filters.push("pt.status = ?");
        params.push(statusParam);
      }

      if (providerParam !== "all") {
        filters.push("pt.provider = ?");
        params.push(providerParam);
      }

      if (searchParam) {
        const like = `%${searchParam}%`;
        filters.push(
          "(pt.gateway_reference LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR CAST(pt.order_id AS CHAR) LIKE ?)",
        );
        params.push(like, like, like, like);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const [rows] = await db.promise().query(
        `SELECT pt.id, pt.order_id, pt.user_id, pt.transaction_type, pt.provider,
                pt.amount, pt.currency, pt.status, pt.gateway_reference,
                pt.external_id, pt.payload, pt.processed_at, pt.created_at,
                o.customer_name, o.customer_email, o.phone AS customer_phone,
                o.status AS order_status, o.payment_status AS order_payment_status,
                o.payment_method AS order_payment_method, o.total_amount AS order_total,
                u.name AS user_name
           FROM payment_transactions pt
           LEFT JOIN orders o ON o.id = pt.order_id
           LEFT JOIN users u ON u.id = pt.user_id
           ${whereClause}
          ORDER BY pt.created_at DESC
          LIMIT ?`,
        [...params, limit],
      );

      const formatted = rows.map((row) => {
        let parsedPayload = null;
        if (row.payload) {
          if (typeof row.payload === "object") {
            parsedPayload = row.payload;
          } else {
            try {
              parsedPayload = JSON.parse(row.payload);
            } catch {
              parsedPayload = null;
            }
          }
        }
        return {
          ...row,
          payload: parsedPayload,
          stage: parsedPayload?.stage || null,
        };
      });

      return res.json(formatted);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch payment transactions" });
    }
  },
);

// GET /api/admin/payments/pending-cod
router.get(
  "/pending-cod",
  authenticateToken,
  isAdmin,
  requirePermission("manage_payments"),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `SELECT id, customer_name, customer_email, phone, city, status,
                payment_method, payment_status, total_amount, shipping_cost,
                transaction_id, created_at
           FROM orders
          WHERE payment_method = 'cod'
            AND status <> 'cancelled'
            AND payment_status IN ('pending', 'partial')
          ORDER BY created_at DESC
          LIMIT 100`,
      );

      const formatted = rows.map((order) => {
        const total = Number(order.total_amount) || 0;
        const shipping = Number(order.shipping_cost) || 0;
        const advancePaid =
          String(order.payment_status).toLowerCase() === "partial" ? shipping : 0;
        const remainingCash = Math.max(0, total - advancePaid);
        return {
          ...order,
          advance_paid: advancePaid,
          remaining_cash: remainingCash,
        };
      });

      return res.json(formatted);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch pending COD orders" });
    }
  },
);

// POST /api/admin/payments/orders/:id/mark-cod-collected
router.post(
  "/orders/:id/mark-cod-collected",
  authenticateToken,
  isAdmin,
  requirePermission("manage_payments"),
  restrictBody("note"),
  async (req, res) => {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    const note = toNullableString(req.body?.note);
    const conn = await db.promise().getConnection();
    let emailCtx = null;

    try {
      await conn.beginTransaction();

      const [[order]] = await conn.query(
        `SELECT id, user_id, customer_name, customer_email, status,
                payment_method, payment_status, total_amount, shipping_cost
           FROM orders
          WHERE id = ?
          FOR UPDATE`,
        [orderId],
      );

      if (!order) {
        await conn.rollback();
        return res.status(404).json({ error: "Order not found" });
      }

      if (String(order.payment_method || "").toLowerCase() !== "cod") {
        await conn.rollback();
        return res.status(400).json({ error: "Only Cash on Delivery orders can be marked collected here" });
      }

      if (String(order.status || "").toLowerCase() === "cancelled") {
        await conn.rollback();
        return res.status(409).json({ error: "Cannot mark a cancelled order as collected" });
      }

      const currentPayStatus = String(order.payment_status || "").toLowerCase();
      if (currentPayStatus === "paid") {
        await conn.rollback();
        return res.status(409).json({ error: "COD payment is already marked as paid" });
      }

      const totalAmount = Number(order.total_amount) || 0;
      const shippingCost = Number(order.shipping_cost) || 0;
      const collectedAmount =
        currentPayStatus === "partial"
          ? Math.max(0, totalAmount - shippingCost)
          : totalAmount;

      const settings = await getAdminSettings().catch(() => ({ currency: "PKR" }));
      const currency = settings.currency || "PKR";

      await conn.query(
        `UPDATE orders
            SET payment_status = 'paid',
                updated_at = NOW()
          WHERE id = ?`,
        [order.id],
      );

      await conn.query(
        `INSERT INTO payment_transactions
           (order_id, user_id, transaction_type, provider, amount, currency, status, payload, processed_at)
         VALUES (?, ?, 'payment', 'cod', ?, ?, 'paid', ?, NOW())`,
        [
          order.id,
          order.user_id || null,
          collectedAmount,
          currency,
          JSON.stringify({
            stage: "final_collection",
            collected_by: req.user.id,
            note: note || null,
            processed_at: new Date().toISOString(),
          }),
        ],
      );

      if (Number.isInteger(order.user_id)) {
        await conn
          .query(
            `INSERT INTO notifications (user_id, type, title, message, payload)
             VALUES (?, 'payment_verified', ?, ?, ?)`,
            [
              order.user_id,
              "COD Payment Received",
              `Cash on Delivery payment of ${currency} ${collectedAmount.toFixed(2)} for Order #${order.id} has been recorded.`,
              JSON.stringify({ order_id: order.id, amount: collectedAmount, provider: "cod" }),
            ],
          )
          .catch(() => {});
      }

      emailCtx = {
        email: order.customer_email,
        customerName: order.customer_name || "Customer",
        orderId: order.id,
        amount: collectedAmount,
      };

      await conn.commit();

      await logAdminAction(
        req.user.id,
        `Marked COD payment collected for order #${order.id} (${currency} ${collectedAmount.toFixed(2)})`,
        getClientIP(req),
      );

      if (emailCtx.email) {
        setImmediate(async () => {
          try {
            const settings = await getAdminSettings();
            await sendPaymentStatusEmail({
              email: emailCtx.email,
              storeName: settings.storeName,
              customerName: emailCtx.customerName,
              orderId: emailCtx.orderId,
              amount: emailCtx.amount,
              currency: settings.currency || "PKR",
              stageLabel: "Cash on Delivery Collection",
              isApproved: true,
            });
          } catch (emailErr) {
            console.warn("[adminPayments] COD receipt email failed:", emailErr?.message || emailErr);
          }
        });
      }

      return res.json({
        success: true,
        message: "COD cash collection recorded",
        order_id: order.id,
        collected_amount: collectedAmount,
      });
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback error
      }
      return res.status(500).json({ error: "Failed to record COD payment collection" });
    } finally {
      conn.release();
    }
  },
);

module.exports = router;
