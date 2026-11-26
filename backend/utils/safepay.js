const crypto = require("crypto");
const { releaseReservationsOnConnection } = require("./stockReservations");

const REQUEST_TIMEOUT_MS = 15_000;

const normalizeEnvironment = (rawValue) => {
  const normalized = String(rawValue || "sandbox").trim().toLowerCase();
  if (normalized === "production" || normalized === "live" || normalized === "prod") {
    return "production";
  }
  return "sandbox";
};

const getSafepayConfig = () => {
  const environment = normalizeEnvironment(process.env.SAFEPAY_ENVIRONMENT);
  const apiKey = String(process.env.SAFEPAY_API_KEY || "").trim();
  const secretKey = String(process.env.SAFEPAY_SECRET_KEY || "").trim();
  const webhookSecret = String(process.env.SAFEPAY_WEBHOOK_SECRET || "").trim();
  const intent = String(process.env.SAFEPAY_INTENT || "CYBERSOURCE").trim().toUpperCase() || "CYBERSOURCE";
  const currency = String(process.env.SAFEPAY_CURRENCY || "PKR").trim().toUpperCase() || "PKR";

  const rawEnabled = String(process.env.SAFEPAY_ENABLED || "").trim().toLowerCase();
  const explicitlyDisabled = rawEnabled === "false" || rawEnabled === "0" || rawEnabled === "no";
  const explicitlyEnabled = rawEnabled === "true" || rawEnabled === "1" || rawEnabled === "yes";

  const hasCredentials = Boolean(apiKey && secretKey);
  const enabled = explicitlyDisabled ? false : (explicitlyEnabled || hasCredentials);
  const configured = Boolean(enabled && hasCredentials);

  const apiBaseUrl =
    environment === "production"
      ? "https://api.getsafepay.com"
      : "https://sandbox.api.getsafepay.com";

  const checkoutBaseUrl =
    environment === "production"
      ? "https://getsafepay.com/embedded/"
      : "https://sandbox.api.getsafepay.com/embedded/";

  return {
    enabled,
    configured,
    webhookConfigured: Boolean(webhookSecret),
    environment,
    apiKey,
    secretKey,
    webhookSecret,
    intent,
    currency,
    apiBaseUrl,
    checkoutBaseUrl,
  };
};

const getPublicSafepayStatus = () => {
  const config = getSafepayConfig();
  return {
    enabled: config.enabled,
    configured: config.configured,
    webhook_configured: config.webhookConfigured,
    environment: config.environment,
    currency: config.currency,
  };
};

const safepayFetchJson = async (url, { method = "GET", headers = {}, body } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      const apiMessage =
        payload?.status?.errors?.join(", ") ||
        payload?.status?.message ||
        payload?.message ||
        payload?.error ||
        `SafePay API returned HTTP ${response.status}`;
      const err = new Error(apiMessage);
      err.code = "SAFEPAY_API_ERROR";
      err.httpStatus = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutErr = new Error("SafePay gateway timed out. Please try again.");
      timeoutErr.code = "SAFEPAY_TIMEOUT";
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const buildSafepayCheckoutUrl = ({
  checkoutBaseUrl,
  environment,
  tracker,
  tbt,
  orderReference,
  redirectUrl,
  cancelUrl,
}) => {
  const url = new URL(checkoutBaseUrl);
  url.searchParams.set("environment", environment);
  if (tbt) {
    url.searchParams.set("tbt", tbt);
  }
  url.searchParams.set("tracker", tracker);
  url.searchParams.set("source", "hosted");
  if (orderReference) {
    url.searchParams.set("order_id", String(orderReference));
  }
  if (redirectUrl) {
    url.searchParams.set("redirect_url", redirectUrl);
  }
  if (cancelUrl) {
    url.searchParams.set("cancel_url", cancelUrl);
  }
  return url.toString();
};

const createSafepaySession = async ({
  amountPkr,
  orderId,
  stage = "full_payment",
  redirectUrl,
  cancelUrl,
}) => {
  const config = getSafepayConfig();
  if (!config.configured) {
    const err = new Error(
      "SafePay payment gateway is not configured. Set SAFEPAY_API_KEY and SAFEPAY_SECRET_KEY in backend/.env.",
    );
    err.code = "SAFEPAY_NOT_CONFIGURED";
    throw err;
  }

  const numericAmount = Number(amountPkr);
  const amountMinor = Math.round(numericAmount * 100);
  if (!Number.isFinite(numericAmount) || amountMinor <= 0) {
    const err = new Error("Invalid payment amount for SafePay session");
    err.code = "SAFEPAY_INVALID_AMOUNT";
    throw err;
  }

  // Step 1: Create SafePay v3 payment tracker
  const orderPayload = await safepayFetchJson(`${config.apiBaseUrl}/order/payments/v3/`, {
    method: "POST",
    headers: {
      "X-SFPY-MERCHANT-SECRET": config.secretKey,
    },
    body: {
      merchant_api_key: config.apiKey,
      intent: config.intent,
      mode: "payment",
      entry_mode: "raw",
      currency: config.currency,
      amount: amountMinor,
      metadata: {
        order_id: String(orderId),
      },
      include_fees: false,
    },
  });

  const tracker = String(
    orderPayload?.data?.tracker?.token ||
      orderPayload?.data?.token ||
      orderPayload?.tracker?.token ||
      orderPayload?.token ||
      "",
  ).trim();

  if (!tracker) {
    const err = new Error("SafePay did not return a payment tracker token.");
    err.code = "SAFEPAY_INVALID_RESPONSE";
    throw err;
  }

  // Step 2: Create short-lived passport token (tbt) for hosted checkout
  const passportPayload = await safepayFetchJson(
    `${config.apiBaseUrl}/client/passport/v1/token`,
    {
      method: "POST",
      headers: {
        "X-SFPY-MERCHANT-SECRET": config.secretKey,
      },
      body: {},
    },
  );

  const tbt = String(
    (typeof passportPayload?.data === "string"
      ? passportPayload.data
      : passportPayload?.data?.token || passportPayload?.token) || "",
  ).trim();

  if (!tbt) {
    const err = new Error("SafePay did not return a checkout session token.");
    err.code = "SAFEPAY_INVALID_RESPONSE";
    throw err;
  }

  const orderReference = String(orderId);
  const checkoutUrl = buildSafepayCheckoutUrl({
    checkoutBaseUrl: config.checkoutBaseUrl,
    environment: config.environment,
    tracker,
    tbt,
    orderReference,
    redirectUrl,
    cancelUrl,
  });

  return {
    tracker,
    checkoutUrl,
    amountMinor,
    amountPkr: Number((amountMinor / 100).toFixed(2)),
    currency: config.currency,
    environment: config.environment,
    stage,
  };
};

const fetchSafepayTrackerStatus = async (tracker) => {
  const config = getSafepayConfig();
  if (!config.configured) {
    const err = new Error("SafePay payment gateway is not configured.");
    err.code = "SAFEPAY_NOT_CONFIGURED";
    throw err;
  }

  const cleanTracker = String(tracker || "").trim();
  if (!cleanTracker) {
    const err = new Error("Payment tracker token is required.");
    err.code = "SAFEPAY_INVALID_TRACKER";
    throw err;
  }

  const payload = await safepayFetchJson(
    `${config.apiBaseUrl}/reporter/api/v1/payments/${encodeURIComponent(cleanTracker)}`,
    {
      method: "GET",
      headers: {
        "X-SFPY-MERCHANT-SECRET": config.secretKey,
      },
    },
  );

  const data = payload?.data || payload || {};
  const trackerObj = data?.tracker || data;
  const state = String(
    trackerObj?.state || data?.state || data?.status || "",
  )
    .trim()
    .toUpperCase();

  const rawAmountMinor = Number(
    trackerObj?.amount ??
      data?.amount ??
      data?.net_amount ??
      data?.totals?.net ??
      0,
  );
  const amountMinor = Number.isFinite(rawAmountMinor) ? rawAmountMinor : 0;
  const currency = String(
    trackerObj?.currency || data?.currency || config.currency || "PKR",
  )
    .trim()
    .toUpperCase();

  const isPaid =
    state === "TRACKER_ENDED" ||
    state === "PAID" ||
    state === "COMPLETED" ||
    state === "SUCCEEDED";

  const isFailed = [
    "TRACKER_EXPIRED",
    "TRACKER_CANCELLED",
    "TRACKER_FAILED",
    "CANCELLED",
    "FAILED",
    "EXPIRED",
  ].includes(state);

  return {
    tracker: cleanTracker,
    state,
    isPaid,
    isFailed,
    amountMinor,
    currency,
    raw: data,
  };
};

const safeTimingEqualHex = (a, b) => {
  const left = Buffer.from(String(a || "").trim().toLowerCase(), "utf8");
  const right = Buffer.from(String(b || "").trim().toLowerCase(), "utf8");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

const verifySafepayWebhookSignature = ({
  rawBody,
  parsedBody = null,
  signature,
  timestamp = "",
  tracker = "",
  webhookSecretOverride = null,
}) => {
  const secret = String(
    webhookSecretOverride ?? getSafepayConfig().webhookSecret ?? "",
  ).trim();

  if (!secret) {
    return { valid: false, reason: "SAFEPAY_WEBHOOK_SECRET is not configured" };
  }

  const normalizedSig = String(Array.isArray(signature) ? signature[0] : signature || "")
    .trim()
    .replace(/^sha(?:256|512)=/i, "");
  if (!normalizedSig) {
    return { valid: false, reason: "Missing X-SFPY-SIGNATURE header" };
  }

  const bodyText = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody || "");

  const payloadsToCheck = [];
  if (Buffer.isBuffer(rawBody) && rawBody.length > 0) {
    payloadsToCheck.push(rawBody);
  } else if (bodyText.length > 0) {
    payloadsToCheck.push(Buffer.from(bodyText, "utf8"));
  }
  if (parsedBody && typeof parsedBody === "object") {
    payloadsToCheck.push(Buffer.from(JSON.stringify(parsedBody), "utf8"));
  }

  // Format 1 (Official SafePay webhook): HMAC-SHA512 over raw or compact JSON payload
  for (const payloadBuf of payloadsToCheck) {
    const sha512Expected = crypto
      .createHmac("sha512", secret)
      .update(payloadBuf)
      .digest("hex");
    if (safeTimingEqualHex(normalizedSig, sha512Expected)) {
      return { valid: true, scheme: "sha512-body" };
    }
  }

  // Format 2 (SafePay v3 timestamped HMAC-SHA256): HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
  if (timestamp) {
    const v3Expected = crypto
      .createHmac("sha256", secret)
      .update(`${String(timestamp).trim()}.${bodyText}`, "utf8")
      .digest("hex");
    if (safeTimingEqualHex(normalizedSig, v3Expected)) {
      return { valid: true, scheme: "sha256-timestamp" };
    }
  }

  // Format 3 (HMAC-SHA256 over raw body)
  for (const payloadBuf of payloadsToCheck) {
    const rawExpected = crypto
      .createHmac("sha256", secret)
      .update(payloadBuf)
      .digest("hex");
    if (safeTimingEqualHex(normalizedSig, rawExpected)) {
      return { valid: true, scheme: "sha256-body" };
    }
  }

  // Format 4 (legacy v1 tracker HMAC-SHA256)
  const cleanTracker = String(tracker || "").trim();
  if (cleanTracker) {
    const trackerExpected = crypto
      .createHmac("sha256", secret)
      .update(cleanTracker, "utf8")
      .digest("hex");
    if (safeTimingEqualHex(normalizedSig, trackerExpected)) {
      return { valid: true, scheme: "sha256-tracker" };
    }
  }

  return { valid: false, reason: "Invalid SafePay webhook signature" };
};

const sweepAbandonedSafepayOrders = async (dbPool, { ttlMinutes = 60 } = {}) => {
  const [candidates] = await dbPool.query(
    `SELECT id, coupon_code
       FROM orders
      WHERE status = 'pending'
        AND payment_status = 'pending'
        AND (
          payment_method = 'safepay'
          OR (payment_method = 'cod' AND transaction_id LIKE 'track_%')
        )
        AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
      LIMIT 50`,
    [ttlMinutes],
  );

  let cancelledCount = 0;

  for (const candidate of candidates) {
    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();

      const [[order]] = await conn.query(
        `SELECT id, status, payment_status, coupon_code
           FROM orders
          WHERE id = ?
          FOR UPDATE`,
        [candidate.id],
      );

      if (
        !order ||
        String(order.status || "").toLowerCase() !== "pending" ||
        String(order.payment_status || "").toLowerCase() !== "pending"
      ) {
        await conn.rollback();
        continue;
      }

      await releaseReservationsOnConnection(conn, order.id);

      const couponCode = String(order.coupon_code || "").trim().toUpperCase();
      if (couponCode) {
        await conn.query(
          `UPDATE coupons
              SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0)
            WHERE code = ? AND used_count > 0`,
          [couponCode],
        );
        await conn.query(
          "DELETE FROM coupon_redemptions WHERE order_id = ? AND code = ?",
          [order.id, couponCode],
        );
      }

      await conn.query(
        `UPDATE orders
            SET status = 'cancelled',
                payment_status = 'failed',
                updated_at = NOW()
          WHERE id = ?`,
        [order.id],
      );

      await conn.query(
        `UPDATE payment_transactions
            SET status = 'cancelled',
                updated_at = NOW()
          WHERE order_id = ? AND provider = 'safepay' AND status = 'pending'`,
        [order.id],
      );

      await conn.query(
        `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by_user_id, note)
         VALUES (?, 'pending', 'cancelled', NULL, ?)`,
        [order.id, "Automatically cancelled after SafePay payment session expired"],
      );

      await conn.commit();
      cancelledCount += 1;
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback error
      }
      console.warn(
        `[safepay-sweeper] failed cancelling abandoned order #${candidate.id}:`,
        error?.message || error,
      );
    } finally {
      conn.release();
    }
  }

  return cancelledCount;
};

const startSafepayAbandonedOrderSweeper = ({
  dbPool,
  intervalMs = 15 * 60_000,
  ttlMinutes = 60,
} = {}) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const cancelled = await sweepAbandonedSafepayOrders(dbPool, { ttlMinutes });
      if (cancelled > 0) {
        console.log(`[safepay-sweeper] cancelled ${cancelled} abandoned SafePay order(s)`);
      }
    } catch (error) {
      console.warn("[safepay-sweeper] sweep failed:", error?.message || error);
    } finally {
      running = false;
    }
  };

  setInterval(tick, intervalMs).unref();
};

module.exports = {
  getSafepayConfig,
  getPublicSafepayStatus,
  buildSafepayCheckoutUrl,
  createSafepaySession,
  fetchSafepayTrackerStatus,
  verifySafepayWebhookSignature,
  sweepAbandonedSafepayOrders,
  startSafepayAbandonedOrderSweeper,
};
