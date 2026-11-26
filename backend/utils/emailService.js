/**
 * Email Service for Naturanza Food
 * Uses Nodemailer with SMTP for sending transactional emails.
 *
 * Every template is built on utils/emailLayout.js, which owns the shared
 * header (logo), preheader, email-client-safe buttons and the contact footer.
 */

const nodemailer = require("nodemailer");
const path = require("path");
const dotenv = require("dotenv");
const { escapeHtml } = require("./htmlEscape");
const {
  BRAND,
  renderEmailLayout,
  renderButton,
  renderLinkFallback,
  renderNotice,
  renderRequestDetails,
  requestDetailsToText,
} = require("./emailLayout");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
  fromName: process.env.EMAIL_FROM_NAME || "Naturanza Food",
  fromEmail: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
  replyTo: process.env.EMAIL_REPLY_TO || "",
};

// Frontend URL for reset links
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const PASSWORD_RESET_MINUTES = Math.max(
  5,
  Number.parseInt(process.env.PASSWORD_RESET_TOKEN_MINUTES || "30", 10) || 30,
);

// Create reusable transporter object using SMTP transport
let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn(
      "Email service not configured. Set SMTP_USER and SMTP_PASS environment variables."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: {
      user: EMAIL_CONFIG.auth.user,
      pass: EMAIL_CONFIG.auth.pass,
    },
    tls: {
      rejectUnauthorized: true, // Verify the SMTP server's TLS certificate (prevents MITM)
    },
    // Connection pool for better performance
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
};

/**
 * Verify email configuration is working
 */
const verifyEmailConfig = async () => {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: "Email service not configured" };
  }

  try {
    await transport.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send an email. Transactional mail carries no priority or unsubscribe headers:
 * "high priority" flags are a spam signal, and List-Unsubscribe belongs only on
 * subscription mail (pass `unsubscribeUrl` for those).
 */
const sendEmail = async ({ to, subject, html, text, unsubscribeUrl }) => {
  const transport = getTransporter();

  if (!transport) {
    return { success: false, error: "Email service not configured" };
  }

  const headers = { "X-Mailer": "Naturanza Food Mailer" };

  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>, <mailto:${EMAIL_CONFIG.fromEmail}?subject=unsubscribe>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const mailOptions = {
    from: {
      name: EMAIL_CONFIG.fromName,
      address: EMAIL_CONFIG.fromEmail,
    },
    to,
    subject,
    html,
    text: text || String(html || "").replace(/<[^>]*>/g, ""), // Strip HTML for text version
    headers,
    messageId: `<${Date.now()}.${Math.random().toString(36).substring(2)}@${(process.env.PUBLIC_SITE_URL || "naturanzafood.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}>`,
  };

  if (EMAIL_CONFIG.replyTo) {
    mailOptions.replyTo = EMAIL_CONFIG.replyTo;
  }

  try {
    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const greetingHtml = (userName) =>
  `<p style="margin: 0 0 20px; color: #475569; font-size: 16px;">Hi${userName ? ` <strong style="color: #1e293b;">${escapeHtml(userName)}</strong>` : ""},</p>`;

const greetingText = (userName) => `Hi${userName ? ` ${String(userName).trim()}` : ""},`;

const contactLineText = () =>
  `Need help? ${BRAND.supportEmail} · WhatsApp +${BRAND.whatsappNumber}`;

/**
 * Generate password reset email HTML
 * @param {object|null} requestContext - { device, ip, location } of the request, shown so the
 *   recipient can spot a reset they did not ask for. Omit for admin-initiated resets.
 */
const generatePasswordResetEmail = ({ userName, resetLink, expiryMinutes, accountLabel, requestContext }) => {
  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Reset your password</h2>
              ${greetingHtml(userName)}
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your ${escapeHtml(accountLabel)} account. Click the button below to choose a new password.
              </p>
${renderButton({ href: resetLink, label: "Reset Password" })}
${renderNotice({
    title: `This link expires in ${expiryMinutes} minutes.`,
    body: "For your security, it can only be used once.",
  })}
${requestContext ? `
              <p style="margin: 0 0 8px; color: #1e293b; font-size: 14px; font-weight: 600;">Request details</p>
${renderRequestDetails(requestContext)}` : ""}
              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
                Didn't request this? You can safely ignore this email &mdash; your password will not change.
                If you keep getting these emails, please contact us.
              </p>
${renderLinkFallback(resetLink)}`;

  return renderEmailLayout({
    title: "Reset your password - Naturanza Food",
    preheader: `Your password reset link expires in ${expiryMinutes} minutes.`,
    contentHtml,
    footerNote: "You received this because a password reset was requested for this email address.",
  });
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} userName - User's name
 * @param {string} resetToken - Password reset token
 * @param {boolean} isAdmin - Whether this is for admin panel (uses different URL)
 * @param {object|null} requestContext - { device, ip, location } of the request that asked for it
 */
const sendPasswordResetEmail = async (email, userName, resetToken, isAdmin = false, requestContext = null) => {
  const resetPath = isAdmin ? "/admin/reset-password" : "/reset-password";
  // Token goes in the fragment: browsers never send it to the server, so it stays
  // out of access logs and Referer headers (see frontend/src/lib/resetToken.js).
  const resetLink = `${FRONTEND_URL}${resetPath}#token=${encodeURIComponent(resetToken)}`;
  const accountLabel = isAdmin ? "Naturanza Food admin" : "Naturanza Food";

  const html = generatePasswordResetEmail({
    userName,
    resetLink,
    expiryMinutes: PASSWORD_RESET_MINUTES,
    accountLabel,
    requestContext,
  });
  const text = `${greetingText(userName)}

We received a request to reset the password for your ${accountLabel} account.

Choose a new password here:
${resetLink}

This link expires in ${PASSWORD_RESET_MINUTES} minutes and can only be used once.
${requestContext ? `\nRequest details:\n${requestDetailsToText(requestContext)}\n` : ""}
Didn't request this? Ignore this email - your password will not change.

${contactLineText()}
- Naturanza Food Team
`;

  return sendEmail({
    to: email,
    subject: isAdmin ? "Reset your admin password - Naturanza Food" : "Reset your password - Naturanza Food",
    html,
    text,
  });
};

/**
 * Security notice sent after any successful password change or reset, so the
 * owner learns about a change they did not make.
 */
const sendPasswordChangedEmail = async ({ email, userName, isAdmin = false, requestContext = null }) => {
  if (!email) return { success: false, error: "No recipient email" };

  const recoverLink = `${FRONTEND_URL}${isAdmin ? "/admin/forgot-password" : "/forgot-password"}`;
  const accountLabel = isAdmin ? "Naturanza Food admin" : "Naturanza Food";

  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Your password was changed</h2>
              ${greetingHtml(userName)}
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                The password for your ${escapeHtml(accountLabel)} account was just changed. For your security, other devices have been signed out.
              </p>
${renderRequestDetails(requestContext || {})}
              <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                If this was you, there's nothing else to do.
              </p>
${renderNotice({
    tone: "danger",
    title: "Didn't change your password?",
    body: "Someone else may have access to your account. Reset your password right away and contact our support team.",
  })}
${renderButton({ href: recoverLink, label: "Secure My Account", accent: "red" })}`;

  const html = renderEmailLayout({
    title: "Your password was changed - Naturanza Food",
    preheader: "Your Naturanza Food password was just changed. Not you? Secure your account now.",
    contentHtml,
    footerNote: "This is a security notification and is sent for every password change.",
  });

  const text = `${greetingText(userName)}

The password for your ${accountLabel} account was just changed. Other devices have been signed out.

${requestDetailsToText(requestContext || {})}

If this was you, there's nothing else to do.

Didn't change your password? Someone else may have access to your account.
Reset it right away: ${recoverLink}

${contactLineText()}
- Naturanza Food Team
`;

  return sendEmail({
    to: email,
    subject: "Your password was changed - Naturanza Food",
    html,
    text,
  });
};

/**
 * Security notice sent when a customer signs in from a device we have not seen
 * on their account before.
 */
const sendNewDeviceLoginEmail = async ({ email, userName, provider = "password", requestContext = null }) => {
  if (!email) return { success: false, error: "No recipient email" };

  const methodLabel = provider === "google" ? "Google sign-in" : "email and password";
  const recoverLink = `${FRONTEND_URL}/forgot-password`;
  const sessionsLink = `${FRONTEND_URL}/profile`;

  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">New sign-in to your account</h2>
              ${greetingHtml(userName)}
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                Your Naturanza Food account was just signed in to from a device we haven't seen before, using ${escapeHtml(methodLabel)}.
              </p>
${renderRequestDetails(requestContext || {})}
              <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                If this was you, you can ignore this email.
              </p>
${renderNotice({
    tone: "danger",
    title: "Don't recognise this sign-in?",
    body: "Change your password now. Changing it signs out every other device.",
  })}
${renderButton({ href: recoverLink, label: "Secure My Account", accent: "red" })}
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                You can review active sessions in your <a href="${escapeHtml(sessionsLink)}" style="color: #16a34a;">profile</a>.
              </p>`;

  const html = renderEmailLayout({
    title: "New sign-in to your account - Naturanza Food",
    preheader: "We noticed a sign-in from a new device. Not you? Secure your account.",
    contentHtml,
    footerNote: "This is a security notification sent when your account is used on a new device.",
  });

  const text = `${greetingText(userName)}

Your Naturanza Food account was just signed in to from a new device, using ${methodLabel}.

${requestDetailsToText(requestContext || {})}

If this was you, you can ignore this email.

Don't recognise this sign-in? Change your password now: ${recoverLink}

${contactLineText()}
- Naturanza Food Team
`;

  return sendEmail({
    to: email,
    subject: "New sign-in to your Naturanza Food account",
    html,
    text,
  });
};

/**
 * Build the newsletter welcome email
 */
const formatPromoDiscount = (coupon) => {
  if (!coupon) return "a special discount";
  const value = Number(coupon.discount_value);
  if (!Number.isFinite(value) || value <= 0) return "a special discount";
  if (coupon.discount_type === "fixed") return `Rs ${value.toLocaleString("en-PK")} off`;
  return `${value % 1 === 0 ? value.toFixed(0) : value}% off`;
};

const unsubscribeFooterNote = (unsubscribeUrl, reason) =>
  `${escapeHtml(reason)} <a href="${escapeHtml(unsubscribeUrl)}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>`;

const generateNewsletterWelcomeEmail = ({
  storeName,
  promoCode,
  promoCoupon,
  unsubscribeUrl,
  siteUrl,
}) => {
  const discountLabel = formatPromoDiscount(promoCoupon);
  const safeStoreName = escapeHtml(storeName || "Naturanza Food");
  const safePromoCode = promoCode ? escapeHtml(promoCode) : "";
  const promoBlock = safePromoCode
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#f0fdf4" style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 8px; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      Welcome Gift &mdash; ${escapeHtml(discountLabel)}
                    </p>
                    <p style="margin: 0 0 12px; color: #047857; font-size: 14px;">
                      Use this code at checkout on your first order:
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td bgcolor="#16a34a" style="background-color: #16a34a; border-radius: 8px; padding: 12px 24px; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 3px; font-family: 'Courier New', monospace;">
                          ${safePromoCode}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`
    : "";

  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Welcome to the family!</h2>
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing to <strong>${safeStoreName}</strong>! You're now part of our community of people who care about pure, natural, and healthy food.
              </p>
              <p style="margin: 0 0 12px; color: #475569; font-size: 15px; line-height: 1.6;">Here's what you can expect from us:</p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>Exclusive offers and early access to new products</li>
                <li>Wellness tips and natural-food recipes</li>
                <li>Updates on sales and seasonal collections</li>
              </ul>
${promoBlock}
${renderButton({ href: `${siteUrl}/shop`, label: "Start Shopping" })}`;

  return renderEmailLayout({
    title: `Welcome to ${storeName || "Naturanza Food"}`,
    preheader: promoCode
      ? `Thanks for subscribing! Here's ${discountLabel} on your first order.`
      : "Thanks for subscribing! Offers, recipes and wellness tips are on the way.",
    contentHtml,
    footerNote: unsubscribeFooterNote(unsubscribeUrl, `You're receiving this because you subscribed to ${storeName || "Naturanza Food"}.`),
  });
};

const sendNewsletterWelcomeEmail = async ({
  email,
  storeName,
  promoCode,
  promoCoupon,
  unsubscribeUrl,
}) => {
  const html = generateNewsletterWelcomeEmail({
    storeName: storeName || "Naturanza Food",
    promoCode: promoCode || "",
    promoCoupon: promoCoupon || null,
    unsubscribeUrl,
    siteUrl: FRONTEND_URL,
  });

  const discountLabel = formatPromoDiscount(promoCoupon);
  const promoLine = promoCode
    ? `\nWelcome gift: use code ${promoCode} at checkout for ${discountLabel} on your first order.\n`
    : "";

  const text = `
Welcome to ${storeName || "Naturanza Food"}!

Thank you for subscribing. You'll get exclusive offers, wellness tips,
and updates on new products.
${promoLine}
Start shopping: ${FRONTEND_URL}/shop

${contactLineText()}
Didn't subscribe? Unsubscribe: ${unsubscribeUrl}
`;

  return sendEmail({
    to: email,
    subject: `Welcome to ${storeName || "Naturanza Food"}!`,
    html,
    text,
    unsubscribeUrl,
  });
};

/**
 * Build a generic broadcast email (admin update / promo / announcement)
 */
const generateNewsletterBroadcastEmail = ({ storeName, subject, preheader, bodyHtml, unsubscribeUrl }) =>
  renderEmailLayout({
    title: subject,
    preheader,
    contentHtml: `
              <div style="color: #1f2937; font-size: 16px; line-height: 1.7;">
                ${bodyHtml}
              </div>`,
    footerNote: unsubscribeFooterNote(unsubscribeUrl, `You're receiving this because you subscribed to ${storeName} updates.`),
  });

const messageBodyToHtml = (message) =>
  escapeHtml(message)
    .split(/\n{2,}/)
    .map((para) => `<p style="margin: 0 0 16px;">${para.replace(/\n/g, "<br />")}</p>`)
    .join("");

const sendNewsletterBroadcastEmail = async ({
  email,
  storeName,
  subject,
  message,
  unsubscribeUrl,
}) => {
  const resolvedStoreName = storeName || "Naturanza Food";
  const html = generateNewsletterBroadcastEmail({
    storeName: resolvedStoreName,
    subject,
    preheader: String(message || "").replace(/\s+/g, " ").trim().slice(0, 120),
    bodyHtml: messageBodyToHtml(message),
    unsubscribeUrl,
  });

  const text = `${message}\n\n— ${resolvedStoreName}\n${contactLineText()}\nUnsubscribe: ${unsubscribeUrl}`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
    unsubscribeUrl,
  });
};

/**
 * Build a payment-status email (approved / rejected) for the customer.
 */
const generatePaymentStatusEmail = ({
  customerName,
  orderId,
  amount,
  currency,
  stageLabel,
  isApproved,
  rejectionReason,
  siteUrl,
}) => {
  const accentColor = isApproved ? "#16a34a" : "#dc2626";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const heading = isApproved ? "Payment Approved" : "Payment Could Not Be Verified";
  const formattedAmount = `${currency || "Rs"} ${Number(amount || 0).toLocaleString("en-PK")}`;
  const safeCustomerName = escapeHtml(customerName || "Customer");
  const safeOrderId = String(orderId).replace(/[^0-9a-zA-Z_-]/g, "");
  const safeStageLabel = escapeHtml(stageLabel || "Payment");
  const safeFormattedAmount = escapeHtml(formattedAmount);

  const reasonBlock =
    !isApproved && rejectionReason
      ? renderNotice({ tone: "danger", title: "Reason", body: rejectionReason })
      : "";

  const bodyIntro = isApproved
    ? `Great news &mdash; we've received and verified your <strong>${safeStageLabel}</strong> payment of <strong>${safeFormattedAmount}</strong> for Order <strong>#${safeOrderId}</strong>. Your order is now moving forward.`
    : `Unfortunately, we could not verify your <strong>${safeStageLabel}</strong> payment of <strong>${safeFormattedAmount}</strong> for Order <strong>#${safeOrderId}</strong>. Please review the reason below and resubmit, or contact support so we can help.`;

  const summaryRow = (label, value, color = "#0f172a") => `
                      <tr>
                        <td style="color: #64748b; font-size: 13px; padding: 4px 0;">${label}</td>
                        <td style="text-align: right; color: ${color}; font-size: 13px; font-weight: 700; padding: 4px 0;">${value}</td>
                      </tr>`;

  const contentHtml = `
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 15px;">Assalam o Alaikum <strong>${safeCustomerName}</strong>,</p>
              <p style="margin: 0 0 20px; color: #1f2937; font-size: 15px; line-height: 1.7;">${bodyIntro}</p>
${reasonBlock}
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${summaryRow("Order", `#${safeOrderId}`)}${summaryRow("Stage", safeStageLabel)}${summaryRow("Amount", safeFormattedAmount, accentColor)}${summaryRow("Status", statusLabel, accentColor)}
                    </table>
                  </td>
                </tr>
              </table>
${renderButton({
    href: `${siteUrl}/orders`,
    label: isApproved ? "Track Your Order" : "View Order & Retry Payment",
    accent: isApproved ? "green" : "red",
  })}`;

  return renderEmailLayout({
    title: `${heading} - Order #${safeOrderId}`,
    preheader: isApproved
      ? `Your ${stageLabel || "payment"} of ${formattedAmount} for Order #${safeOrderId} is confirmed.`
      : `We couldn't verify your payment for Order #${safeOrderId}. Here's what to do next.`,
    heading,
    subheading: `Order #${safeOrderId} · ${statusLabel}`,
    accent: isApproved ? "green" : "red",
    contentHtml,
  });
};

const sendPaymentStatusEmail = async ({
  email,
  customerName,
  orderId,
  amount,
  currency,
  stageLabel,
  isApproved,
  rejectionReason,
}) => {
  if (!email) return { success: false, error: "No customer email" };

  const html = generatePaymentStatusEmail({
    customerName,
    orderId,
    amount,
    currency: currency || "Rs",
    stageLabel: stageLabel || "Payment",
    isApproved: Boolean(isApproved),
    rejectionReason: rejectionReason || "",
    siteUrl: FRONTEND_URL,
  });

  const statusLabel = isApproved ? "Approved" : "Rejected";
  const subject = isApproved
    ? `Payment Approved — Order #${orderId}`
    : `Payment Could Not Be Verified — Order #${orderId}`;

  const text = isApproved
    ? `Your ${stageLabel} payment of ${currency || "Rs"} ${amount} for Order #${orderId} has been ${statusLabel}.\n\nTrack your order: ${FRONTEND_URL}/orders\n\n${contactLineText()}`
    : `Your ${stageLabel} payment of ${currency || "Rs"} ${amount} for Order #${orderId} could not be verified.${
        rejectionReason ? `\n\nReason: ${rejectionReason}` : ""
      }\n\nView order: ${FRONTEND_URL}/orders\n\n${contactLineText()}`;

  return sendEmail({ to: email, subject, html, text });
};

/**
 * Send a 6-digit email verification code for new self-signup accounts.
 */
const sendVerificationCodeEmail = async (email, userName, code, expiryMinutes = 15) => {
  const safeCode = escapeHtml(code);
  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Verify your email</h2>
              ${greetingHtml(userName)}
              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                Use the verification code below to confirm your email and activate your Naturanza Food account.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 8px auto 16px;">
                <tr>
                  <td align="center" bgcolor="#f0fdf4" style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px 32px; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #065f46; font-family: 'Courier New', monospace;">
                    ${safeCode}
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 13px; text-align: center;">
                This code expires in ${expiryMinutes} minutes. Never share it with anyone &mdash; our team will never ask for it.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                If you didn't try to create a Naturanza Food account, you can safely ignore this email.
              </p>`;

  const html = renderEmailLayout({
    title: "Verify your email - Naturanza Food",
    preheader: `Your verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
    contentHtml,
  });

  const text = `${greetingText(userName)}

Your Naturanza Food verification code is: ${code}

This code expires in ${expiryMinutes} minutes. Never share it with anyone.

If you didn't try to create an account, you can ignore this email.

${contactLineText()}
- Naturanza Food Team`;

  return sendEmail({
    to: email,
    subject: `${code} is your Naturanza Food verification code`,
    html,
    text,
  });
};


const generateNewsletterVerificationEmail = ({
  storeName,
  verificationUrl,
  unsubscribeUrl,
}) => {
  const contentHtml = `
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Confirm your subscription</h2>
              <p style="margin: 0 0 24px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Thanks for subscribing to <strong>${escapeHtml(storeName)}</strong>. Please confirm your email address to join our newsletter.
              </p>
${renderButton({ href: verificationUrl, label: "Confirm Subscription" })}
              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
                This link expires in 24 hours. Didn't subscribe? Just ignore this email &mdash; you won't be added.
              </p>
${renderLinkFallback(verificationUrl)}`;

  return renderEmailLayout({
    title: "Confirm your subscription - Naturanza Food",
    preheader: "One click to confirm your Naturanza Food newsletter subscription.",
    contentHtml,
    footerNote: unsubscribeFooterNote(unsubscribeUrl, "You received this because this address was entered on our newsletter form."),
  });
};

const sendNewsletterVerificationEmail = async ({
  email,
  storeName,
  verificationUrl,
  unsubscribeUrl,
}) => {
  const html = generateNewsletterVerificationEmail({
    storeName: storeName || "Naturanza Food",
    verificationUrl,
    unsubscribeUrl,
  });

  const text = `
Confirm your subscription to ${storeName || "Naturanza Food"}!

Please click the link below to complete your newsletter signup:
${verificationUrl}

This link expires in 24 hours.

Didn't subscribe? Unsubscribe: ${unsubscribeUrl}
`;

  return sendEmail({
    to: email,
    subject: "Confirm your Naturanza Food subscription",
    html,
    text,
    unsubscribeUrl,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendNewDeviceLoginEmail,
  sendVerificationCodeEmail,
  sendNewsletterVerificationEmail,
  sendNewsletterWelcomeEmail,
  sendNewsletterBroadcastEmail,
  sendPaymentStatusEmail,
  verifyEmailConfig,
  getTransporter,
  FRONTEND_URL,
};
