/**
 * Email Service for Naturanza Food
 * Uses Nodemailer with Gmail SMTP for sending transactional emails
 * 
 * Configuration:
 * - Uses Gmail App Password for authentication (more secure than regular password)
 * - Configured with proper headers to avoid spam filters
 */

const nodemailer = require("nodemailer");
const path = require("path");
const dotenv = require("dotenv");

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
  // Proper sender name to avoid spam
  fromName: process.env.EMAIL_FROM_NAME || "Naturanza Food",
  fromEmail: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
};

// Frontend URL for reset links
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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
    // Additional settings to improve deliverability
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
 * Send email with proper headers to avoid spam filters
 */
const sendEmail = async ({ to, subject, html, text, unsubscribeUrl }) => {
  const transport = getTransporter();

  if (!transport) {
    return { success: false, error: "Email service not configured" };
  }

  const headers = {
    "X-Priority": "1",
    "X-MSMail-Priority": "High",
    "Importance": "high",
    "X-Mailer": "Naturanza Food Mailer",
    "List-Unsubscribe": unsubscribeUrl
      ? `<${unsubscribeUrl}>, <mailto:${EMAIL_CONFIG.fromEmail}?subject=unsubscribe>`
      : `<mailto:${EMAIL_CONFIG.fromEmail}?subject=unsubscribe>`,
  };

  if (unsubscribeUrl) {
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
    text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    headers,
    messageId: `<${Date.now()}.${Math.random().toString(36).substring(2)}@${(process.env.PUBLIC_SITE_URL || "naturanzafood.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}>`,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Generate password reset email HTML
 */
const generatePasswordResetEmail = (userName, resetLink, expiryMinutes = 60) => {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset Your Password - Naturanza Food</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); padding: 32px 40px; text-align: center;">
              <img src="https://raw.githubusercontent.com/mehar99197/Naturanza_Frontend_Backend/main/frontend/public/images/logo.png" alt="Naturanza Food" style="max-width: 200px; height: auto; margin-bottom: 12px;" />
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Pure. Natural. Healthy.
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">
                Reset Your Password
              </h2>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                Hi${userName ? ` <strong>${userName}</strong>` : ""},
              </p>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your Naturanza Food account. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; padding: 12px 16px; background-color: #f1f5f9; border-radius: 8px; word-break: break-all;">
                <a href="${resetLink}" style="color: #16a34a; text-decoration: none; font-size: 13px;">${resetLink}</a>
              </p>
              
              <!-- Warning -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef3c7; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                      ⏰ <strong>This link expires in ${expiryMinutes} minutes.</strong><br>
                      For security reasons, this link can only be used once.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Security notice -->
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; text-align: center;">
                This is an automated message from Naturanza Food.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${currentYear} Naturanza Food. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} userName - User's name
 * @param {string} resetToken - Password reset token
 * @param {boolean} isAdmin - Whether this is for admin panel (uses different URL)
 */
const sendPasswordResetEmail = async (email, userName, resetToken, isAdmin = false) => {
  // Use different paths for admin and regular users
  const resetPath = isAdmin ? "/admin/reset-password" : "/reset-password";
  const resetLink = `${FRONTEND_URL}${resetPath}?token=${resetToken}`;
  const expiryMinutes = Math.max(
    5,
    Number.parseInt(process.env.PASSWORD_RESET_TOKEN_MINUTES || "30", 10) || 30,
  );

  const accountType = isAdmin ? "Admin" : "Naturanza Food";
  const html = generatePasswordResetEmail(userName, resetLink, expiryMinutes);
  const text = `
Hi${userName ? ` ${userName}` : ""},

We received a request to reset your password for your ${accountType} account.

Click the link below to create a new password:
${resetLink}

This link expires in ${expiryMinutes} minutes and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

- Naturanza Food Team
`;

  return sendEmail({
    to: email,
    subject: isAdmin ? "Reset Your Admin Password - Naturanza Food" : "Reset Your Password - Naturanza Food",
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

const generateNewsletterWelcomeEmail = ({
  storeName,
  promoCode,
  promoCoupon,
  unsubscribeUrl,
  siteUrl,
}) => {
  const currentYear = new Date().getFullYear();
  const discountLabel = formatPromoDiscount(promoCoupon);
  const promoBlock = promoCode
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px dashed #16a34a; border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      Welcome Gift — ${discountLabel}
                    </p>
                    <p style="margin: 0 0 12px; color: #047857; font-size: 14px;">
                      Use this code at checkout on your first order:
                    </p>
                    <p style="margin: 0; padding: 12px 24px; display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 3px; border-radius: 8px; font-family: 'Courier New', monospace;">
                      ${promoCode}
                    </p>
                  </td>
                </tr>
              </table>
              `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); padding: 36px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Welcome to the Family! 🌿
              </h1>
              <p style="margin: 12px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                Pure. Natural. Healthy.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing to <strong>${storeName}</strong>! You're now part of our community of people who care about pure, natural, and healthy food.
              </p>
              <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
                Here's what you can expect from us:
              </p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>Exclusive offers and early access to new products</li>
                <li>Wellness tips and natural-food recipes</li>
                <li>Updates on sales and seasonal collections</li>
              </ul>
              ${promoBlock}
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${siteUrl}/shop" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                      Start Shopping
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                Didn't subscribe? You can <a href="${unsubscribeUrl}" style="color: #16a34a;">unsubscribe here</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${currentYear} ${storeName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
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
const generateNewsletterBroadcastEmail = ({ storeName, subject, bodyHtml, unsubscribeUrl }) => {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); padding: 28px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                ${storeName}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px; color: #1f2937; font-size: 16px; line-height: 1.7;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px; color: #64748b; font-size: 12px;">
                You are receiving this because you subscribed to ${storeName} updates.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                <a href="${unsubscribeUrl}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a>
                &nbsp;·&nbsp; © ${currentYear} ${storeName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  const html = generateNewsletterBroadcastEmail({
    storeName: storeName || "Naturanza Food",
    subject,
    bodyHtml: messageBodyToHtml(message),
    unsubscribeUrl,
  });

  const text = `${message}\n\n— ${storeName || "Naturanza Food"}\nUnsubscribe: ${unsubscribeUrl}`;

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
 * Same shell as the welcome email — branded header, content body, footer.
 */
const generatePaymentStatusEmail = ({
  storeName,
  customerName,
  orderId,
  amount,
  currency,
  stageLabel,
  isApproved,
  rejectionReason,
  siteUrl,
}) => {
  const currentYear = new Date().getFullYear();
  const accentColor = isApproved ? "#16a34a" : "#dc2626";
  const accentGradient = isApproved
    ? "linear-gradient(135deg, #16a34a 0%, #059669 100%)"
    : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const heading = isApproved ? "Payment Approved" : "Payment Could Not Be Verified";
  const formattedAmount = `${currency || "Rs"} ${Number(amount || 0).toLocaleString("en-PK")}`;

  const reasonBlock =
    !isApproved && rejectionReason
      ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0 0 4px; color: #991b1b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                      Reason
                    </p>
                    <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.55;">
                      ${rejectionReason}
                    </p>
                  </td>
                </tr>
              </table>
              `
      : "";

  const ctaText = isApproved ? "Track Your Order" : "View Order & Retry Payment";
  const bodyIntro = isApproved
    ? `Great news — we've received and verified your <strong>${stageLabel}</strong> payment of <strong>${formattedAmount}</strong> for Order <strong>#${orderId}</strong>. Your order is now moving forward.`
    : `Unfortunately, we could not verify your <strong>${stageLabel}</strong> payment of <strong>${formattedAmount}</strong> for Order <strong>#${orderId}</strong>. Please review the reason below and resubmit, or contact support so we can help.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} — Order #${orderId}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0fdf4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:${accentGradient};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">${heading}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.92);font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
                Order #${orderId} · ${statusLabel}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;color:#1f2937;font-size:15px;line-height:1.7;">
              <p style="margin:0 0 16px;">Assalam o Alaikum <strong>${customerName || "Customer"}</strong>,</p>
              <p style="margin:0 0 20px;">${bodyIntro}</p>
              ${reasonBlock}
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:10px;margin:8px 0 24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding:4px 0;">Order</td>
                        <td style="text-align:right;color:#0f172a;font-size:13px;font-weight:600;padding:4px 0;">#${orderId}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding:4px 0;">Stage</td>
                        <td style="text-align:right;color:#0f172a;font-size:13px;font-weight:600;padding:4px 0;">${stageLabel}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding:4px 0;">Amount</td>
                        <td style="text-align:right;color:${accentColor};font-size:13px;font-weight:700;padding:4px 0;">${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding:4px 0;">Status</td>
                        <td style="text-align:right;color:${accentColor};font-size:13px;font-weight:700;padding:4px 0;">${statusLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:6px 0 12px;">
                    <a href="${siteUrl}/orders" target="_blank" style="display:inline-block;background:${accentGradient};color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                Need help? Reply to this email or contact us on WhatsApp.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © ${currentYear} ${storeName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const sendPaymentStatusEmail = async ({
  email,
  storeName,
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
    storeName: storeName || "Naturanza Food",
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
    ? `Your ${stageLabel} payment of ${currency || "Rs"} ${amount} for Order #${orderId} has been ${statusLabel}.\n\nTrack your order: ${FRONTEND_URL}/orders`
    : `Your ${stageLabel} payment of ${currency || "Rs"} ${amount} for Order #${orderId} could not be verified.${
        rejectionReason ? `\n\nReason: ${rejectionReason}` : ""
      }\n\nView order: ${FRONTEND_URL}/orders`;

  return sendEmail({ to: email, subject, html, text });
};

/**
 * Send a 6-digit email verification code for new self-signup accounts.
 */
const sendVerificationCodeEmail = async (email, userName, code, expiryMinutes = 15) => {
  const greetingName = userName ? ` ${userName}` : "";
  const html = `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f7f4;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#15803d,#047857);padding:24px 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Naturanza Food</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#1f2937;font-size:15px;">Hi${greetingName},</p>
          <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
            Use the verification code below to confirm your email and activate your Naturanza Food account.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;background:#f0fdf4;border:2px dashed #16a34a;border-radius:12px;padding:18px 32px;">
              <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#065f46;">${code}</span>
            </div>
          </div>
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px;text-align:center;">
            This code expires in ${expiryMinutes} minutes.
          </p>
          <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">
            If you didn't try to create a Naturanza Food account, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 28px;text-align:center;color:#9ca3af;font-size:11px;">
          &copy; ${new Date().getFullYear()} Naturanza Food. Pure Nature. Pure Health.
        </td></tr>
      </table>
    </td></tr>
  </table>`;

  const text = `Hi${greetingName},

Your Naturanza Food verification code is: ${code}

This code expires in ${expiryMinutes} minutes.

If you didn't try to create an account, you can ignore this email.

- Naturanza Food Team`;

  return sendEmail({
    to: email,
    subject: `${code} is your Naturanza Food verification code`,
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationCodeEmail,
  sendNewsletterWelcomeEmail,
  sendNewsletterBroadcastEmail,
  sendPaymentStatusEmail,
  verifyEmailConfig,
  getTransporter,
  FRONTEND_URL,
};
