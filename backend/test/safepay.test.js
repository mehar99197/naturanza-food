/**
 * DB-free regression tests for the SafePay payment gateway integration
 * and removal of legacy manual payment verification flows.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  getSafepayConfig,
  getPublicSafepayStatus,
  buildSafepayCheckoutUrl,
  createSafepaySession,
  fetchSafepayTrackerStatus,
  verifySafepayWebhookSignature,
} = require("../utils/safepay");

const backendRoot = path.join(__dirname, "..");
const frontendRoot = path.join(backendRoot, "..", "frontend");

const withEnv = async (overrides, fn) => {
  const backup = {};
  for (const key of Object.keys(overrides)) {
    backup[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (backup[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = backup[key];
      }
    }
  }
};

test("getSafepayConfig resolves sandbox and production URLs without leaking secrets publicly", async () => {
  await withEnv(
    {
      SAFEPAY_ENABLED: "true",
      SAFEPAY_ENVIRONMENT: "sandbox",
      SAFEPAY_API_KEY: "sec_sandbox_test_key",
      SAFEPAY_SECRET_KEY: "super_secret_value",
      SAFEPAY_WEBHOOK_SECRET: "whsec_secret_value",
      SAFEPAY_CURRENCY: "PKR",
    },
    async () => {
      const cfg = getSafepayConfig();
      assert.equal(cfg.configured, true);
      assert.equal(cfg.environment, "sandbox");
      assert.equal(cfg.apiBaseUrl, "https://sandbox.api.getsafepay.com");
      assert.equal(cfg.checkoutBaseUrl, "https://sandbox.api.getsafepay.com/embedded/");

      const publicStatus = getPublicSafepayStatus();
      assert.equal(publicStatus.configured, true);
      assert.equal(publicStatus.webhook_configured, true);
      assert.equal(publicStatus.apiKey, undefined);
      assert.equal(publicStatus.secretKey, undefined);
      assert.equal(publicStatus.webhookSecret, undefined);
    },
  );

  await withEnv(
    {
      SAFEPAY_ENABLED: "true",
      SAFEPAY_ENVIRONMENT: "production",
      SAFEPAY_API_KEY: "",
      SAFEPAY_SECRET_KEY: "",
    },
    async () => {
      const cfg = getSafepayConfig();
      assert.equal(cfg.configured, false);
      assert.equal(cfg.apiBaseUrl, "https://api.getsafepay.com");
      assert.equal(cfg.checkoutBaseUrl, "https://getsafepay.com/embedded/");
    },
  );
});

test("buildSafepayCheckoutUrl constructs hosted checkout URL with expected query params", () => {
  const url = new URL(
    buildSafepayCheckoutUrl({
      checkoutBaseUrl: "https://sandbox.api.getsafepay.com/embedded/",
      environment: "sandbox",
      tracker: "track_12345",
      tbt: "tbt_token_abc",
      orderReference: "42",
      redirectUrl: "https://naturanzafood.com/payment/safepay/result?order_id=42",
      cancelUrl: "https://naturanzafood.com/payment/safepay/cancel?order_id=42",
    }),
  );

  assert.equal(url.origin, "https://sandbox.api.getsafepay.com");
  assert.equal(url.pathname, "/embedded/");
  assert.equal(url.searchParams.get("environment"), "sandbox");
  assert.equal(url.searchParams.get("tracker"), "track_12345");
  assert.equal(url.searchParams.get("tbt"), "tbt_token_abc");
  assert.equal(url.searchParams.get("source"), "hosted");
  assert.equal(url.searchParams.get("order_id"), "42");
});

test("verifySafepayWebhookSignature validates official SHA-512, v3 SHA-256, and legacy tracker HMAC signatures", () => {
  const secret = "test_webhook_secret_xyz";
  const parsedBody = {
    type: "payment.succeeded",
    data: { tracker: "track_abc123", state: "TRACKER_ENDED" },
  };
  const rawBody = JSON.stringify(parsedBody);
  const timestamp = "2026-11-25T10:00:00Z";

  const sha512Sig = crypto
    .createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  assert.equal(
    verifySafepayWebhookSignature({
      rawBody,
      parsedBody,
      signature: sha512Sig,
      webhookSecretOverride: secret,
    }).valid,
    true,
  );

  const v3Sig = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  assert.equal(
    verifySafepayWebhookSignature({
      rawBody,
      signature: v3Sig,
      timestamp,
      tracker: "track_abc123",
      webhookSecretOverride: secret,
    }).valid,
    true,
  );

  const legacySig = crypto
    .createHmac("sha256", secret)
    .update("track_abc123", "utf8")
    .digest("hex");

  assert.equal(
    verifySafepayWebhookSignature({
      rawBody,
      signature: legacySig,
      tracker: "track_abc123",
      webhookSecretOverride: secret,
    }).valid,
    true,
  );

  assert.equal(
    verifySafepayWebhookSignature({
      rawBody: `${rawBody}tampered`,
      signature: v3Sig,
      timestamp,
      tracker: "track_abc123",
      webhookSecretOverride: secret,
    }).valid,
    false,
  );

  assert.equal(
    verifySafepayWebhookSignature({
      rawBody,
      signature: v3Sig,
      timestamp,
      webhookSecretOverride: "",
    }).valid,
    false,
  );
});

test("createSafepaySession and fetchSafepayTrackerStatus handle v3 API responses cleanly", async () => {
  const originalFetch = global.fetch;

  await withEnv(
    {
      SAFEPAY_ENABLED: "true",
      SAFEPAY_ENVIRONMENT: "sandbox",
      SAFEPAY_API_KEY: "sec_sandbox_key",
      SAFEPAY_SECRET_KEY: "secret_sandbox_key",
      SAFEPAY_INTENT: "CYBERSOURCE",
      SAFEPAY_CURRENCY: "PKR",
    },
    async () => {
      try {
        global.fetch = async (url) => {
          const u = String(url);
          if (u.endsWith("/order/payments/v3/")) {
            return {
              ok: true,
              status: 200,
              text: async () =>
                JSON.stringify({ data: { tracker: { token: "track_mock_99" } } }),
            };
          }
          if (u.endsWith("/client/passport/v1/token")) {
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify({ data: "tbt_mock_xyz" }),
            };
          }
          if (u.includes("/reporter/api/v1/payments/track_mock_99")) {
            return {
              ok: true,
              status: 200,
              text: async () =>
                JSON.stringify({
                  data: {
                    tracker: {
                      token: "track_mock_99",
                      state: "TRACKER_ENDED",
                      amount: 145000,
                      currency: "PKR",
                    },
                  },
                }),
            };
          }
          return { ok: false, status: 404, text: async () => "{}" };
        };

        const session = await createSafepaySession({
          amountPkr: 1450,
          orderId: 77,
          stage: "full_payment",
          redirectUrl: "http://localhost:5173/payment/safepay/result?order_id=77",
          cancelUrl: "http://localhost:5173/payment/safepay/cancel?order_id=77",
        });

        assert.equal(session.tracker, "track_mock_99");
        assert.equal(session.amountMinor, 145000);
        assert.match(session.checkoutUrl, /\/embedded\/\?/);
        assert.match(session.checkoutUrl, /environment=sandbox/);
        assert.match(session.checkoutUrl, /tracker=track_mock_99/);
        assert.match(session.checkoutUrl, /tbt=tbt_mock_xyz/);

        const status = await fetchSafepayTrackerStatus("track_mock_99");
        assert.equal(status.isPaid, true);
        assert.equal(status.state, "TRACKER_ENDED");
        assert.equal(status.amountMinor, 145000);
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});

test("legacy manual payment endpoints and UI components are completely removed", () => {
  const paymentsSource = fs.readFileSync(path.join(backendRoot, "routes/payments.js"), "utf8");
  assert.doesNotMatch(paymentsSource, /submit-verification/);
  assert.doesNotMatch(paymentsSource, /accounts\/active/);
  assert.match(paymentsSource, /\/safepay\/create-session/);
  assert.match(paymentsSource, /\/safepay\/verify/);

  const indexSource = fs.readFileSync(path.join(backendRoot, "index.js"), "utf8");
  const webhookPos = indexSource.indexOf("/api/payments/safepay/webhook");
  const jsonPos = indexSource.indexOf("app.use(express.json(");
  assert.ok(webhookPos > 0 && jsonPos > webhookPos, "SafePay raw webhook must mount before express.json()");

  assert.equal(
    fs.existsSync(path.join(frontendRoot, "src/components/AdminPaymentsExtensions.jsx")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(frontendRoot, "src/utils/whatsappRejection.js")),
    false,
  );
});
