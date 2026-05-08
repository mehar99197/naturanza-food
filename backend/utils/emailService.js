/**
 * Email Service for Naturanza Foods
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
  fromName: process.env.EMAIL_FROM_NAME || "Naturanza Foods",
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
      rejectUnauthorized: false, // Allow self-signed certificates
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
    console.error("Email configuration verification failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send email with proper headers to avoid spam filters
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  
  if (!transport) {
    console.error("Email service not configured. Cannot send email.");
    return { success: false, error: "Email service not configured" };
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
    // Headers to improve deliverability and avoid spam
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high",
      "X-Mailer": "Naturanza Foods Mailer",
      "List-Unsubscribe": `<mailto:${EMAIL_CONFIG.fromEmail}?subject=unsubscribe>`,
    },
    // Message ID for tracking
    messageId: `<${Date.now()}.${Math.random().toString(36).substring(2)}@naturanzafoods.com>`,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email:", error.message);
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
  <title>Reset Your Password - Naturanza Foods</title>
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
              <img src="https://raw.githubusercontent.com/mehar99197/Naturanza_Frontend_Backend/main/frontend/public/images/logo.png" alt="Naturanza Foods" style="max-width: 200px; height: auto; margin-bottom: 12px;" />
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
                We received a request to reset your password for your Naturanza Foods account. Click the button below to create a new password:
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
                This is an automated message from Naturanza Foods.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${currentYear} Naturanza Foods. All rights reserved.
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

  const accountType = isAdmin ? "Admin" : "Naturanza Foods";
  const html = generatePasswordResetEmail(userName, resetLink, expiryMinutes);
  const text = `
Hi${userName ? ` ${userName}` : ""},

We received a request to reset your password for your ${accountType} account.

Click the link below to create a new password:
${resetLink}

This link expires in ${expiryMinutes} minutes and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

- Naturanza Foods Team
`;

  return sendEmail({
    to: email,
    subject: isAdmin ? "Reset Your Admin Password - Naturanza Foods" : "Reset Your Password - Naturanza Foods",
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
  getTransporter,
  FRONTEND_URL,
};
