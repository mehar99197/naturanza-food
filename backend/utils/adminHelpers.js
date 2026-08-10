const crypto = require('crypto');
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
  }
}

// Get client IP address — trusts Express req.ip (set by trust proxy)
function getClientIP(req) {
  return req.ip || req.connection?.remoteAddress || null;
}

module.exports = {
  generateSecurePassword,
  logAdminAction,
  getClientIP
};
