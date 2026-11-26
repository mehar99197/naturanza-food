const crypto = require('crypto');
const { db } = require('../config/db');

// Generate a cryptographically strong password that satisfies all 4 character
// classes (uppercase, lowercase, digit, special) and the >=12 char policy.
function generateSecurePassword(length = 20) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%^&*-_=+';
  const all = upper + lower + digits + specials;
  const targetLen = Math.max(16, length);

  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    specials[crypto.randomInt(specials.length)],
  ];
  while (chars.length < targetLen) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
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
