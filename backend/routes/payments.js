const express = require("express");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const { consumeReservationsOnConnection } = require("../utils/stockReservations");
const { getAdminSettings } = require("../utils/adminSettings");
const { insertAdminNotifications } = require("../utils/adminNotifications");
const { sendPaymentStatusEmail } = require("../utils/emailService");
const {
  getSafepayConfig,
  getPublicSafepayStatus,
  createSafepaySession,
  fetchSafepayTrackerStatus,
  verifySafepayWebhookSignature,
} = require("../utils/safepay");

const CHECKOUT_PAYMENT_METHODS = new Set(["safepay", "cod"]);
const DEFAULT_CHECKOUT_METHODS = [
  {
    code: "safepay",
    label: "SafePay",
    description: "Pay securely online with Cards, Raast, or Mobile Wallets via SafePay",
    sort_order: 1,
    supports_online: 1,
  },
  {
    code: "cod",
    label: "Cash on Delivery",
    description: "Pay on delivery (delivery fee advance via SafePay when applicable)",
    sort_order: 2,
    supports_online: 0,
  },
];

const getFrontendBaseUrl = (req) => {
  const configured = String(
    process.env.FRONTEND_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.CLIENT_URL ||
      "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  const origin = String(req?.headers?.origin || "").trim().replace(/\/+$/, "");
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin;
  }

  return "http://localhost:5173";
};

const isOrderOwnerOrPaymentAdmin = (order, user) => {
  if (!order || !user) return false;
  if (Number(order.user_id) === Number(user.id)) return true;
  const role = String(user.role || "").trim().toLowerCase();
  const adminRole = String(user.admin_role || "").trim().toLowerCase();
  const perms = Array.isArray(user.admin_permissions)
    ? user.admin_permissions.map((value) => String(value).trim())
    : [];
  return (
    role === "admin" &&
    (adminRole === "super_admin" || perms.includes("manage_payments"))
  );
};

const resolveSafepayChargeForOrder = (order) => {
  const method = String(order?.payment_method || "").trim().toLowerCase();
  if (method === "cod") {
    return {
      stage: "advance_shipping",
      amount: Number(order.shipping_cost) || 0,
      stageLabel: "Delivery Fee Advance (SafePay)",
    };
  }
  return {
    stage: "full_payment",
    amount: Number(order.total_amount) || 0,
    stageLabel: "Full Online Payment (SafePay)",
  };
};

// Atomically settle a verified SafePay payment. Idempotent across both the
// customer redirect verification call and SafePay's server-to-server webhook.
const settleSafepayPayment = async ({
  orderId,
  tracker,
  trackerStatus,
  source = "verify",
}) => {
  const numericOrderId = Number.parseInt(orderId, 10);
  if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
    const err = new Error("Invalid order id");
    err.statusCode = 400;
    throw err;
  }

  const conn = await db.promise().getConnection();
  let emailContext = null;

  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      `SELECT id, user_id, customer_name, customer_email, status, payment_method,
              payment_status, total_amount, shipping_cost, transaction_id
         FROM orders
        WHERE id = ?
        FOR UPDATE`,
      [numericOrderId],
    );

    if (!order) {
      await conn.rollback();
      const err = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    const { stage, amount: expectedAmount, stageLabel } = resolveSafepayChargeForOrder(order);
    const expectedAmountMinor = Math.round(expectedAmount * 100);
    const currentPaymentStatus = String(order.payment_status || "").toLowerCase();
    const currentOrderStatus = String(order.status || "").toLowerCase();

    // Idempotent exit if already settled for this stage
    if (
      (stage === "full_payment" && currentPaymentStatus === "paid") ||
      (stage === "advance_shipping" &&
        (currentPaymentStatus === "partial" || currentPaymentStatus === "paid"))
    ) {
      await conn.commit();
      return {
        alreadySettled: true,
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        stage,
        amount: expectedAmount,
        tracker,
      };
    }

    if (currentOrderStatus === "cancelled") {
      await conn.rollback();
      const err = new Error("This order has been cancelled and cannot be paid.");
      err.statusCode = 409;
      throw err;
    }

    // Verify amount returned by SafePay matches authoritative DB amount (1 PKR tolerance)
    if (
      trackerStatus.amountMinor > 0 &&
      Math.abs(trackerStatus.amountMinor - expectedAmountMinor) > 100
    ) {
      await conn.rollback();
      const err = new Error("SafePay payment amount does not match the order total.");
      err.statusCode = 400;
      throw err;
    }

    const consumedCount = await consumeReservationsOnConnection(
      conn,
      order.id,
      order.user_id || null,
    );
    const stockWarning = consumedCount === 0;

    const nextPaymentStatus = stage === "advance_shipping" ? "partial" : "paid";
    const nextOrderStatus =
      currentOrderStatus === "pending" ? "confirmed" : order.status;

    await conn.query(
      `UPDATE orders
          SET payment_status = ?,
              status = ?,
              transaction_id = ?,
              updated_at = NOW()
        WHERE id = ?`,
      [nextPaymentStatus, nextOrderStatus, tracker, order.id],
    );

    const txPayload = JSON.stringify({
      gateway: "safepay",
      tracker,
      state: trackerStatus.state || "TRACKER_ENDED",
      amount_minor: trackerStatus.amountMinor || expectedAmountMinor,
      currency: trackerStatus.currency || "PKR",
      source,
      stage,
      stock_warning: stockWarning,
      processed_at: new Date().toISOString(),
    });

    const [[existingTx]] = await conn.query(
      `SELECT id
         FROM payment_transactions
        WHERE order_id = ? AND provider = 'safepay' AND gateway_reference = ?
        LIMIT 1
        FOR UPDATE`,
      [order.id, tracker],
    );

    if (existingTx) {
      await conn.query(
        `UPDATE payment_transactions
            SET status = 'paid',
                amount = ?,
                currency = ?,
                external_id = ?,
                payload = ?,
                processed_at = NOW(),
                updated_at = NOW()
          WHERE id = ?`,
        [
          expectedAmount,
          trackerStatus.currency || "PKR",
          tracker,
          txPayload,
          existingTx.id,
        ],
      );
    } else {
      await conn.query(
        `INSERT INTO payment_transactions
           (order_id, user_id, transaction_type, provider, amount, currency, status,
            gateway_reference, external_id, payload, processed_at)
         VALUES (?, ?, 'payment', 'safepay', ?, ?, 'paid', ?, ?, ?, NOW())`,
        [
          order.id,
          order.user_id || null,
          expectedAmount,
          trackerStatus.currency || "PKR",
          tracker,
          tracker,
          txPayload,
        ],
      );
    }

    if (currentOrderStatus === "pending") {
      await conn.query(
        `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by_user_id, note)
         VALUES (?, 'pending', 'confirmed', ?, ?)`,
        [
          order.id,
          order.user_id || null,
          `SafePay ${stage === "advance_shipping" ? "delivery fee advance" : "payment"} confirmed (${tracker})`,
        ],
      );
    }

    if (Number.isInteger(order.user_id)) {
      await conn
        .query(
          `INSERT INTO notifications (user_id, type, title, message, payload)
           VALUES (?, 'payment_verified', ?, ?, ?)`,
          [
            order.user_id,
            "Payment Confirmed via SafePay",
            `Your ${stageLabel} of PKR ${expectedAmount.toFixed(2)} for Order #${order.id} was verified via SafePay.`,
            JSON.stringify({
              order_id: order.id,
              tracker,
              stage,
              amount: expectedAmount,
              provider: "safepay",
            }),
          ],
        )
        .catch(() => {});
    }

    await insertAdminNotifications(conn, {
      type: "admin_payment_received",
      title: "SafePay Payment Received",
      message: `Order #${order.id} paid PKR ${expectedAmount.toFixed(2)} via SafePay (${stage === "advance_shipping" ? "COD Advance" : "Full Payment"}).`,
      payload: {
        order_id: order.id,
        tracker,
        stage,
        amount: expectedAmount,
        provider: "safepay",
      },
      excludeUserId: order.user_id || null,
    }).catch(() => {});

    emailContext = {
      email: order.customer_email,
      customerName: order.customer_name || "Customer",
      orderId: order.id,
      amount: expectedAmount,
      stageLabel,
    };

    await conn.commit();

    if (emailContext.email) {
      setImmediate(async () => {
        try {
          const settings = await getAdminSettings();
          await sendPaymentStatusEmail({
            email: emailContext.email,
            storeName: settings.storeName,
            customerName: emailContext.customerName,
            orderId: emailContext.orderId,
            amount: emailContext.amount,
            currency: settings.currency || "PKR",
            stageLabel: emailContext.stageLabel,
            isApproved: true,
          });
        } catch (emailErr) {
          console.warn("[safepay] confirmation email failed:", emailErr?.message || emailErr);
        }
      });
    }

    return {
      alreadySettled: false,
      orderId: order.id,
      orderStatus: nextOrderStatus,
      paymentStatus: nextPaymentStatus,
      stage,
      amount: expectedAmount,
      tracker,
    };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // preserve original error
    }
    throw error;
  } finally {
    conn.release();
  }
};

// GET /api/payments/methods/active — SafePay + COD only (no manual wallet/bank methods)
router.get("/methods/active", authenticateToken, async (req, res) => {
  const safepayStatus = getPublicSafepayStatus();

  const enrichMethods = (methods) =>
    methods.map((method) => {
      const code = String(method.code || "").trim().toLowerCase();
      if (code === "safepay") {
        return {
          ...method,
          code: "safepay",
          supports_online: 1,
          gateway_configured: safepayStatus.configured,
          gateway_environment: safepayStatus.environment,
        };
      }
      if (code === "cod") {
        return {
          ...method,
          code: "cod",
          safepay_advance_enabled: safepayStatus.configured,
        };
      }
      return method;
    });

  try {
    const [rows] = await db.promise().query(
      `SELECT code, label, description, sort_order, supports_online
         FROM payment_methods
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, created_at ASC`,
    );

    if (rows.length === 0) {
      return res.json(enrichMethods(DEFAULT_CHECKOUT_METHODS));
    }

    const checkoutMethods = rows.filter((row) =>
      CHECKOUT_PAYMENT_METHODS.has(String(row.code || "").trim().toLowerCase()),
    );

    if (checkoutMethods.length === 0) {
      return res.json(enrichMethods(DEFAULT_CHECKOUT_METHODS));
    }

    return res.json(enrichMethods(checkoutMethods));
  } catch {
    return res.json(enrichMethods(DEFAULT_CHECKOUT_METHODS));
  }
});

// GET /api/payments/safepay/config
router.get("/safepay/config", authenticateToken, (req, res) => {
  return res.json(getPublicSafepayStatus());
});

// POST /api/payments/safepay/create-session
router.post(
  "/safepay/create-session",
  authenticateToken,
  restrictBody("order_id"),
  async (req, res) => {
    try {
      const orderId = Number.parseInt(req.body?.order_id, 10);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: "A valid order_id is required" });
      }

      const [[order]] = await db.promise().query(
        `SELECT id, user_id, status, payment_method, payment_status, total_amount, shipping_cost
           FROM orders
          WHERE id = ?
          LIMIT 1`,
        [orderId],
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (!isOrderOwnerOrPaymentAdmin(order, req.user)) {
        return res.status(403).json({ error: "You do not have access to this order" });
      }

      const orderStatus = String(order.status || "").toLowerCase();
      const paymentStatus = String(order.payment_status || "").toLowerCase();
      const orderMethod = String(order.payment_method || "").toLowerCase();

      if (orderStatus === "cancelled") {
        return res.status(409).json({ error: "Cannot pay for a cancelled order" });
      }

      if (!CHECKOUT_PAYMENT_METHODS.has(orderMethod)) {
        return res.status(400).json({
          error: "This order uses an unsupported payment method for SafePay",
        });
      }

      const { stage, amount } = resolveSafepayChargeForOrder(order);

      if (
        (stage === "full_payment" && paymentStatus === "paid") ||
        (stage === "advance_shipping" &&
          (paymentStatus === "partial" || paymentStatus === "paid"))
      ) {
        return res.status(409).json({
          error: "Payment for this order has already been completed.",
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          error:
            stage === "advance_shipping"
              ? "No delivery advance fee is due for this order."
              : "Order total is invalid for SafePay checkout.",
        });
      }

      const frontendBase = getFrontendBaseUrl(req);
      const redirectUrl = `${frontendBase}/payment/safepay/result?order_id=${order.id}`;
      const cancelUrl = `${frontendBase}/payment/safepay/cancel?order_id=${order.id}`;

      const session = await createSafepaySession({
        amountPkr: amount,
        orderId: order.id,
        stage,
        redirectUrl,
        cancelUrl,
      });

      const payload = JSON.stringify({
        gateway: "safepay",
        tracker: session.tracker,
        amount_minor: session.amountMinor,
        currency: session.currency,
        environment: session.environment,
        stage,
        source: "create_session",
      });

      await db.promise().query(
        `UPDATE orders SET transaction_id = ?, updated_at = NOW() WHERE id = ?`,
        [session.tracker, order.id],
      );

      await db.promise().query(
        `INSERT INTO payment_transactions
           (order_id, user_id, transaction_type, provider, amount, currency, status,
            gateway_reference, external_id, payload)
         VALUES (?, ?, 'payment', 'safepay', ?, ?, 'pending', ?, ?, ?)`,
        [
          order.id,
          order.user_id || req.user.id,
          session.amountPkr,
          session.currency,
          session.tracker,
          session.tracker,
          payload,
        ],
      );

      return res.json({
        success: true,
        order_id: order.id,
        order_number: `ORD-${String(order.id).padStart(6, "0")}`,
        tracker: session.tracker,
        checkout_url: session.checkoutUrl,
        stage,
        amount: session.amountPkr,
        currency: session.currency,
        environment: session.environment,
      });
    } catch (error) {
      if (error?.code === "SAFEPAY_NOT_CONFIGURED") {
        return res.status(503).json({ error: error.message });
      }
      if (error?.code === "SAFEPAY_TIMEOUT") {
        return res.status(504).json({ error: error.message });
      }
      // The raw gateway message (e.g. SafePay's auth-strategy errors) is for
      // the logs only: it means nothing to a customer and talks about "jwt
      // tokens", which the storefront used to mistake for an expired login.
      console.error("[safepay] create-session failed:", error?.message || error);
      return res.status(502).json({
        code: "SAFEPAY_GATEWAY_ERROR",
        error:
          "Online payment is temporarily unavailable. Your order is saved — please try again in a few minutes or choose Cash on Delivery.",
      });
    }
  },
);

// POST /api/payments/safepay/verify
router.post(
  "/safepay/verify",
  authenticateToken,
  restrictBody("order_id", "tracker"),
  async (req, res) => {
    try {
      const orderId = Number.parseInt(req.body?.order_id, 10);
      const requestedTracker = String(req.body?.tracker || "").trim();

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: "A valid order_id is required" });
      }

      const [[order]] = await db.promise().query(
        `SELECT id, user_id, status, payment_method, payment_status,
                total_amount, shipping_cost, transaction_id, city, customer_email
           FROM orders
          WHERE id = ?
          LIMIT 1`,
        [orderId],
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (!isOrderOwnerOrPaymentAdmin(order, req.user)) {
        return res.status(403).json({ error: "You do not have access to this order" });
      }

      const tracker = requestedTracker || String(order.transaction_id || "").trim();
      if (!tracker) {
        return res.status(400).json({
          error: "Missing SafePay payment tracker for this order.",
        });
      }

      // Verify the tracker belongs to this order (prevents cross-order replay)
      const [[knownTx]] = await db.promise().query(
        `SELECT id
           FROM payment_transactions
          WHERE order_id = ? AND provider = 'safepay' AND gateway_reference = ?
          LIMIT 1`,
        [order.id, tracker],
      );
      if (!knownTx && String(order.transaction_id || "").trim() !== tracker) {
        return res.status(400).json({
          error: "This SafePay tracker does not belong to the specified order.",
        });
      }

      const trackerStatus = await fetchSafepayTrackerStatus(tracker);

      if (!trackerStatus.isPaid) {
        return res.status(200).json({
          success: false,
          verified: false,
          state: trackerStatus.state || "PENDING",
          order_id: order.id,
          order_number: `ORD-${String(order.id).padStart(6, "0")}`,
          payment_status: order.payment_status,
          message: trackerStatus.isFailed
            ? "SafePay payment was cancelled or failed."
            : "Payment is still being confirmed by SafePay. Please check again shortly.",
        });
      }

      const settled = await settleSafepayPayment({
        orderId: order.id,
        tracker,
        trackerStatus,
        source: "verify",
      });

      return res.json({
        success: true,
        verified: true,
        already_settled: settled.alreadySettled,
        order_id: order.id,
        order_number: `ORD-${String(order.id).padStart(6, "0")}`,
        order_status: settled.orderStatus,
        payment_status: settled.paymentStatus,
        payment_method: order.payment_method,
        stage: settled.stage,
        amount_paid: settled.amount,
        total_amount: Number(order.total_amount) || 0,
        shipping_cost: Number(order.shipping_cost) || 0,
        remaining_cod:
          settled.stage === "advance_shipping"
            ? Math.max(0, (Number(order.total_amount) || 0) - (Number(order.shipping_cost) || 0))
            : 0,
        city: order.city || "",
        customer_email: order.customer_email || "",
        tracker,
      });
    } catch (error) {
      const status = error?.statusCode || (error?.code === "SAFEPAY_NOT_CONFIGURED" ? 503 : 500);
      return res.status(status).json({
        error: error?.message || "Failed to verify SafePay payment",
      });
    }
  },
);

// POST /api/payments/safepay/cancel
router.post(
  "/safepay/cancel",
  authenticateToken,
  restrictBody("order_id", "tracker"),
  async (req, res) => {
    try {
      const orderId = Number.parseInt(req.body?.order_id, 10);
      const tracker = String(req.body?.tracker || "").trim();

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: "A valid order_id is required" });
      }

      const [[order]] = await db.promise().query(
        `SELECT id, user_id, payment_status, transaction_id
           FROM orders
          WHERE id = ?
          LIMIT 1`,
        [orderId],
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (!isOrderOwnerOrPaymentAdmin(order, req.user)) {
        return res.status(403).json({ error: "You do not have access to this order" });
      }

      const effectiveTracker = tracker || String(order.transaction_id || "").trim();
      if (effectiveTracker) {
        await db.promise().query(
          `UPDATE payment_transactions
              SET status = 'cancelled', updated_at = NOW()
            WHERE order_id = ? AND provider = 'safepay' AND gateway_reference = ? AND status = 'pending'`,
          [order.id, effectiveTracker],
        );
      }

      return res.json({
        success: true,
        order_id: order.id,
        order_number: `ORD-${String(order.id).padStart(6, "0")}`,
        message: "SafePay payment session cancelled. You can retry payment anytime before expiry.",
      });
    } catch (error) {
      return res.status(500).json({
        error: error?.message || "Failed to record cancelled payment",
      });
    }
  },
);

// Server-to-server SafePay Webhook Handler — mounted in index.js with express.raw()
// BEFORE express.json() and BEFORE CSRF so raw-body HMAC verification works cleanly.
const safepayWebhookHandler = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
          "utf8",
        );

    let event = null;
    try {
      event = JSON.parse(rawBody.toString("utf8") || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const data = event?.data || event || {};
    const tracker = String(
      data?.tracker?.token ||
        data?.tracker ||
        data?.notification?.tracker ||
        event?.tracker ||
        "",
    ).trim();

    const sigCheck = verifySafepayWebhookSignature({
      rawBody,
      parsedBody: event,
      signature: req.headers["x-sfpy-signature"],
      timestamp: req.headers["x-sfpy-timestamp"],
      tracker,
    });

    if (!sigCheck.valid) {
      return res.status(401).json({ error: sigCheck.reason || "Invalid webhook signature" });
    }

    const eventType = String(
      req.headers["x-sfpy-event-type"] ||
        event?.type ||
        event?.event_type ||
        data?.state ||
        "",
    )
      .trim()
      .toLowerCase();

    if (!tracker) {
      return res.status(200).json({ received: true, ignored: "No tracker in payload" });
    }

    const [[txRow]] = await db.promise().query(
      `SELECT order_id
         FROM payment_transactions
        WHERE provider = 'safepay' AND gateway_reference = ?
        ORDER BY id DESC
        LIMIT 1`,
      [tracker],
    );

    let orderId = txRow?.order_id || null;
    if (!orderId) {
      const metadataOrderId = Number.parseInt(
        data?.metadata?.order_id || data?.tracker?.metadata?.order_id || "",
        10,
      );
      if (Number.isInteger(metadataOrderId) && metadataOrderId > 0) {
        orderId = metadataOrderId;
      }
    }
    if (!orderId) {
      const [[orderRow]] = await db.promise().query(
        `SELECT id FROM orders WHERE transaction_id = ? LIMIT 1`,
        [tracker],
      );
      orderId = orderRow?.id || null;
    }

    if (!orderId) {
      return res.status(200).json({ received: true, ignored: "Order not found for tracker" });
    }

    const isSuccessEvent =
      eventType.includes("succeed") ||
      eventType.includes("completed") ||
      eventType.includes("tracker_ended") ||
      eventType === "payment.paid";

    const isFailureEvent =
      eventType.includes("fail") ||
      eventType.includes("cancel") ||
      eventType.includes("expire");

    if (isSuccessEvent) {
      // Authoritatively verify tracker state with SafePay API when credentials are present
      let trackerStatus = {
        tracker,
        state: "TRACKER_ENDED",
        isPaid: true,
        amountMinor: Number(data?.amount || data?.tracker?.amount || 0) || 0,
        currency: String(data?.currency || getSafepayConfig().currency || "PKR").toUpperCase(),
      };

      if (getSafepayConfig().configured) {
        const fetched = await fetchSafepayTrackerStatus(tracker);
        if (!fetched.isPaid) {
          return res.status(200).json({
            received: true,
            ignored: `Tracker state is ${fetched.state}`,
          });
        }
        trackerStatus = fetched;
      }

      await settleSafepayPayment({
        orderId,
        tracker,
        trackerStatus,
        source: "webhook",
      });
    } else if (isFailureEvent) {
      await db.promise().query(
        `UPDATE payment_transactions
            SET status = ?, updated_at = NOW()
          WHERE order_id = ? AND provider = 'safepay' AND gateway_reference = ? AND status = 'pending'`,
        [eventType.includes("cancel") ? "cancelled" : "failed", orderId, tracker],
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[safepay] webhook error:", error?.message || error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};

router.safepayWebhookHandler = safepayWebhookHandler;

module.exports = router;
