const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { db } = require('../config/db');

// Generate secure random password
function generateSecurePassword() {
  return crypto.randomBytes(10).toString('hex');
}

// Log admin action to audit table
async function logAdminAction(adminId, action, ipAddress = null) {
  try {
    await db.promise().query(
      'INSERT INTO admin_audit_logs (admin_id, action, ip_address) VALUES (?, ?, ?)',
      [adminId, action, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

// Get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         null;
}

// Send welcome email to new admin
async function sendWelcomeEmail(email, fullName, password) {
  try {
    // Create transporter (configure with your SMTP settings)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Naturanza Foods Admin" <${process.env.SMTP_USER || 'noreply@naturanza.com'}>`,
      to: email,
      subject: 'Welcome to Naturanza Foods Admin Panel',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Welcome to Naturanza Foods Admin Panel</h2>
          <p>Hello ${fullName},</p>
          <p>Your admin account has been created successfully. Here are your login credentials:</p>
          <div style="background-color: #f0f8f2; padding: 15px; border-left: 4px solid #16a34a; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
          </div>
          <p>Please login and change your password immediately for security purposes.</p>
          <p><strong>Login URL:</strong> <a href="${process.env.ADMIN_URL || 'http://localhost:5173/admin/login'}" style="color: #16a34a;">Admin Login</a></p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            If you didn't request this account, please contact the system administrator immediately.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw error - email failure shouldn't block admin creation
  }
}

module.exports = {
  generateSecurePassword,
  logAdminAction,
  getClientIP,
  sendWelcomeEmail
};
