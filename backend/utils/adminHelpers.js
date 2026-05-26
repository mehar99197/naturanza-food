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

// Get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         null;
}

module.exports = {
  generateSecurePassword,
  logAdminAction,
  getClientIP
};
