const newsletterModel = require("../models/newsletterModel");
const couponModel = require("../models/couponModel");
const { dbPool } = require("../config/db");
const { getAdminSettings } = require("../utils/adminSettings");
const {
  sendNewsletterVerificationEmail,
  sendNewsletterWelcomeEmail,
  sendNewsletterBroadcastEmail,
  FRONTEND_URL,
} = require("../utils/emailService");
const { escapeHtml } = require("../utils/htmlEscape");

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  process.env.PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://naturanzafood.com"
    : `http://localhost:${process.env.PORT || 5000}`);
const NORMALIZED_BACKEND_URL = String(BACKEND_URL).replace(/\/+$/, "");

const buildUnsubscribeUrl = (token) =>
  `${NORMALIZED_BACKEND_URL}/api/newsletter/unsubscribe/${encodeURIComponent(token)}`;

const buildVerificationUrl = (token) =>
  `${NORMALIZED_BACKEND_URL}/api/newsletter/verify/${encodeURIComponent(token)}`;

const notifyAdminsOfSubscriber = async (subscriber) => {
  try {
    const [admins] = await dbPool.query(
      "SELECT id FROM users WHERE role = 'admin'",
    );
    if (!admins.length) return;
    const values = admins.map((row) => [
      row.id,
      "admin_newsletter_subscribed",
      "New Newsletter Subscriber",
      `${subscriber.email} confirmed their subscription.`,
      JSON.stringify({
        subscriber_id: subscriber.id,
        email: subscriber.email,
        source: subscriber.source,
      }),
    ]);
    await dbPool.query(
      `INSERT INTO notifications (user_id, type, title, message, payload)
       VALUES ?`,
      [values],
    );
  } catch (error) {
    console.warn("Could not insert admin notification for newsletter subscribe:", error.message);
  }
};

const subscribe = async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const source = String(req.body?.source || "footer").trim();

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const { subscriber, alreadySubscribed, pendingVerification } = await newsletterModel.subscribe({
    email,
    source,
  });

  if (alreadySubscribed) {
    return res.status(200).json({
      message: "You're already subscribed — thank you for staying with us!",
      alreadySubscribed: true,
    });
  }

  // Fire-and-forget verification email (do not block the response)
  (async () => {
    try {
      const settings = await getAdminSettings();
      await sendNewsletterVerificationEmail({
        email: subscriber.email,
        storeName: settings.storeName,
        verificationUrl: buildVerificationUrl(subscriber.verification_token),
        unsubscribeUrl: buildUnsubscribeUrl(subscriber.unsubscribe_token),
      });
    } catch (error) {
      console.warn("Verification email failed for", subscriber.email, "-", error.message);
    }
  })();

  return res.status(201).json({
    message: "Please check your email and click the confirmation link to complete your subscription.",
    pendingVerification,
  });
};

const renderMessagePage = ({
  title,
  heading,
  message,
  accent = "#16a34a",
  showHomeLink = true,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0fdf4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:${accent};padding:36px 40px;text-align:center;color:#fff;">
              <h1 style="margin:0;font-size:24px;font-weight:700;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.7;text-align:center;">
              <p style="margin:0 0 20px;">${message}</p>
              ${showHomeLink ? `<a href="${FRONTEND_URL}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;">Back to Naturanza Food</a>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const unsubscribe = async (req, res) => {
  const token = String(req.params?.token || "").trim();
  if (!token) {
    return res
      .status(400)
      .type("html")
      .send(
        renderMessagePage({
          title: "Invalid link",
          heading: "Invalid Unsubscribe Link",
          message: "This link is missing required information.",
          accent: "#dc2626",
        }),
      );
  }

  try {
    const subscriber = await newsletterModel.unsubscribeByToken(token);
    return res.type("html").send(
      renderMessagePage({
        title: "Unsubscribed",
        heading: "You're unsubscribed",
        message: `<strong>${escapeHtml(subscriber.email)}</strong> has been removed from our list. We're sorry to see you go!`,
      }),
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .type("html")
      .send(
        renderMessagePage({
          title: "Unsubscribe failed",
          heading: "Could not unsubscribe",
          message: error.message || "Something went wrong. Please try again later.",
          accent: "#dc2626",
        }),
      );
  }
};

const verify = async (req, res) => {
  const token = String(req.params?.token || "").trim();
  if (!token) {
    return res
      .status(400)
      .type("html")
      .send(
        renderMessagePage({
          title: "Invalid link",
          heading: "Invalid Verification Link",
          message: "This link is missing required information.",
          accent: "#dc2626",
        }),
      );
  }

  try {
    const subscriber = await newsletterModel.verifyByToken(token);

    // Fire-and-forget welcome email and admin notification
    (async () => {
      try {
        const settings = await getAdminSettings();
        const code = settings.newsletterWelcomePromoCode || "";
        const coupon = code ? await couponModel.findByCode(code) : null;
        await sendNewsletterWelcomeEmail({
          email: subscriber.email,
          storeName: settings.storeName,
          promoCode: code,
          promoCoupon: coupon,
          unsubscribeUrl: buildUnsubscribeUrl(subscriber.unsubscribe_token),
        });
        notifyAdminsOfSubscriber(subscriber);
      } catch (error) {
        console.warn("Welcome email failed for", subscriber.email, "-", error.message);
      }
    })();

    return res.type("html").send(
      renderMessagePage({
        title: "Subscription confirmed",
        heading: "You're all set! 🌿",
        message: `<strong>${escapeHtml(subscriber.email)}</strong> has been successfully subscribed to our newsletter.`,
      }),
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .type("html")
      .send(
        renderMessagePage({
          title: "Verification failed",
          heading: "Could not confirm subscription",
          message: error.message || "Something went wrong. Please try again later.",
          accent: "#dc2626",
        }),
      );
  }
};

const listSubscribers = async (req, res) => {
  const status = String(req.query?.status || "").trim() || null;
  const search = String(req.query?.search || "").trim() || null;
  const limit = req.query?.limit;

  const [subscribers, counts] = await Promise.all([
    newsletterModel.listSubscribers({ status, search, limit }),
    newsletterModel.countByStatus(),
  ]);

  return res.json({ subscribers, counts });
};

const deleteSubscriber = async (req, res) => {
  const deleted = await newsletterModel.deleteById(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Subscriber not found" });
  }
  return res.json({ message: "Subscriber removed" });
};

const broadcast = async (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!subject || subject.length > 200) {
    return res
      .status(400)
      .json({ error: "Subject is required (max 200 characters)" });
  }
  if (!message || message.length < 10 || message.length > 10000) {
    return res
      .status(400)
      .json({ error: "Message must be between 10 and 10000 characters" });
  }

  const settings = await getAdminSettings();
  const subscribers = await newsletterModel.listActiveForBroadcast();

  if (!subscribers.length) {
    return res.status(400).json({ error: "No active subscribers to email" });
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const result = await sendNewsletterBroadcastEmail({
      email: sub.email,
      storeName: settings.storeName,
      subject,
      message,
      unsubscribeUrl: buildUnsubscribeUrl(sub.unsubscribe_token),
    });
    if (result.success) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return res.json({
    message: `Broadcast finished — ${sent} sent, ${failed} failed`,
    sent,
    failed,
    total: subscribers.length,
  });
};

/**
 * Save the welcome promo code and, if a matching coupon does not yet exist,
 * create one with sensible defaults so the code actually works at checkout.
 * Existing coupons are never overwritten — admin can refine them in
 * /admin/coupons.
 */
const setWelcomePromo = async (req, res) => {
  const rawCode = String(req.body?.code ?? "").trim().toUpperCase().slice(0, 40);

  await updateAdminSettings(null, { newsletterWelcomePromoCode: rawCode });

  if (!rawCode) {
    return res.json({
      code: "",
      coupon: null,
      created: false,
      message: "Welcome promo code cleared",
    });
  }

  const { coupon, created } = await couponModel.ensureCoupon(rawCode, {
    discount_type: "percentage",
    discount_value: 10,
    description: "Welcome offer for newsletter subscribers",
  });

  return res.json({
    code: rawCode,
    coupon,
    created,
    message: created
      ? `Saved. Created a new coupon "${rawCode}" (10% off, no expiry). You can change the discount in Coupons.`
      : `Saved. Linked to existing coupon "${rawCode}".`,
  });
};

module.exports = {
  subscribe,
  unsubscribe,
  verify,
  listSubscribers,
  deleteSubscriber,
  broadcast,
  setWelcomePromo,
};
