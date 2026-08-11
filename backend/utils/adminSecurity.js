const { db } = require("../config/db");
const { sendEmail } = require("./emailService");
const { ipMatchesCidr } = require("./ipAllowlist");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const toBoolean = (value) => value === true || Number(value) === 1;

const resolveDeviceName = (userAgent = "") => {
  const ua = String(userAgent || "");
  const lowered = ua.toLowerCase();

  if (!ua) {
    return "Unknown Device";
  }

  const browser = lowered.includes("edg/")
    ? "Edge"
    : lowered.includes("chrome/")
      ? "Chrome"
      : lowered.includes("firefox/")
        ? "Firefox"
        : lowered.includes("safari/") && !lowered.includes("chrome/")
          ? "Safari"
          : lowered.includes("opr/") || lowered.includes("opera")
            ? "Opera"
            : "Browser";

  const device = lowered.includes("android")
    ? "Android"
    : lowered.includes("iphone")
      ? "iPhone"
      : lowered.includes("ipad")
        ? "iPad"
        : lowered.includes("windows")
          ? "Windows"
          : lowered.includes("mac os") || lowered.includes("macintosh")
            ? "macOS"
            : lowered.includes("linux")
              ? "Linux"
              : "Device";

  return `${browser} on ${device}`;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const listAllowlistEntries = async (database = db.promise()) => {
  const [rows] = await database.query(
    `SELECT id, label, cidr, created_by, created_at
     FROM admin_security_ip_allowlist
     ORDER BY created_at ASC, id ASC`,
  );
  return rows;
};

// Empty allowlist = feature disabled (no lockout risk on fresh installs).
const isSuperAdminIpAllowed = async ({ ipAddress, database = db.promise() }) => {
  const entries = await listAllowlistEntries(database);
  if (!entries.length) {
    return true;
  }
  return entries.some((entry) => ipMatchesCidr(ipAddress, entry.cidr));
};

// Audit logging must never break the request it decorates — swallow errors.
const recordAdminAuditLog = async ({
  adminId,
  action,
  category = "admin_action",
  actorEmail = null,
  ipAddress = null,
  userAgent = null,
  metadata = null,
  database = db.promise(),
}) => {
  try {
    if (!adminId || !action) return;
    await database.query(
      `INSERT INTO admin_audit_logs
        (admin_id, action, category, actor_email, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        String(action).slice(0, 500),
        String(category || "admin_action").slice(0, 60),
        actorEmail ? String(actorEmail).slice(0, 254) : null,
        ipAddress ? String(ipAddress).slice(0, 64) : null,
        userAgent ? String(userAgent).slice(0, 255) : null,
        metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
      ],
    );
  } catch {
    // Never let audit logging break auth or admin flows.
  }
};


const sendAdminLoginAlert = async ({
  admin,
  ipAddress,
  deviceName,
  locationLabel,
  status,
  reason,
}) => {
  try {
    if (!admin?.email) return;

    const isSuccess = status === "success";
    const subject = isSuccess
      ? "Security Alert: Admin login successful"
      : "Security Alert: Admin login attempt blocked";
    const time = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
    const safe = {
      name: escapeHtml(admin.name || "Admin"),
      email: escapeHtml(admin.email),
      ip: escapeHtml(ipAddress || "Unknown"),
      device: escapeHtml(deviceName || "Unknown Device"),
      location: escapeHtml(locationLabel || "Unknown"),
      reason: escapeHtml(reason || ""),
      time: escapeHtml(time),
    };

    await sendEmail({
      to: admin.email,
      subject,
      text: `${subject}\n\nAccount: ${admin.email}\nTime: ${time}\nIP: ${ipAddress || "Unknown"}\nDevice: ${deviceName || "Unknown Device"}\nLocation: ${locationLabel || "Unknown"}${reason ? `\nReason: ${reason}` : ""}\n\nIf this was not you, reset your admin password immediately and review the Security page.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2 style="color:${isSuccess ? "#166534" : "#b91c1c"}">${escapeHtml(subject)}</h2>
          <p>Hello ${safe.name},</p>
          <p>A ${isSuccess ? "successful" : "blocked"} admin login event was recorded for <strong>${safe.email}</strong>.</p>
          <table style="border-collapse:collapse;width:100%;max-width:560px">
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Time (PKT)</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${safe.time}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>IP Address</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${safe.ip}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Device</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${safe.device}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Location</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${safe.location}</td></tr>
            ${isSuccess ? "" : `<tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Reason</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${safe.reason}</td></tr>`}
          </table>
          <p style="margin-top:18px">If this was not you, reset your admin password immediately and review the Security page in the admin panel.</p>
        </div>
      `,
    });
  } catch {
    // Alert email failure must never block login.
  }
};

const getSecurityOverview = async ({ userId }) => {
  const database = db.promise();
  const [userRows] = await database.query(
    `SELECT id, email, name, role, admin_role, admin_permissions, two_fa_enabled,
            two_fa_enabled_at, two_fa_recovery_codes, password_set_by_user, updated_at, last_login
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  const user = userRows[0];
  if (!user) {
    return null;
  }

  const [sessions] = await database.query(
    `SELECT id, login_provider, ip_address, user_agent, last_seen_at, created_at
     FROM user_sessions
     WHERE user_id = ? AND is_active = TRUE
     ORDER BY COALESCE(last_seen_at, created_at) DESC
     LIMIT 20`,
    [userId],
  );

  const [loginAttempts] = await database.query(
    `SELECT id, login_provider, ip_address, device_name, location_label, status, failure_reason, created_at
     FROM user_login_history
     WHERE user_id = ? OR attempted_email = ?
     ORDER BY created_at DESC
     LIMIT 25`,
    [userId, user.email],
  );

  const [permissionChanges] = await database.query(
    `SELECT id, admin_id, action, ip_address, created_at
     FROM admin_audit_logs
     WHERE admin_id = ? AND (action LIKE '%permission%' OR action LIKE '%role%' OR action LIKE '%status%')
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId],
  );

  const [auditLogs] = await database.query(
    `SELECT id, admin_id, action, ip_address, created_at
     FROM admin_audit_logs
     WHERE admin_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId],
  );

  const [lastLoginRows] = await database.query(
    `SELECT created_at, ip_address, device_name, location_label
     FROM user_login_history
     WHERE user_id = ? AND status = 'success'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const lastLogin = lastLoginRows[0] || null;

  return {
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      adminRole: user.admin_role,
      isSuperAdmin: String(user.admin_role || "").toLowerCase() === "super_admin",
      permissions: parseJsonArray(user.admin_permissions),
      twoFactorEnabled: toBoolean(user.two_fa_enabled),
      twoFactorEnabledAt: user.two_fa_enabled_at || null,
      recoveryCodesRemaining: parseJsonArray(user.two_fa_recovery_codes).length,
      passwordLastChanged: user.updated_at || null,
      lastLogin: lastLogin?.created_at || user.last_login || null,
      lastLoginIp: lastLogin?.ip_address || null,
      lastLoginDevice: lastLogin?.device_name || null,
      lastLoginLocation: lastLogin?.location_label || null,
    },
    sessions,
    loginAttempts,
    permissionChanges,
    auditLogs,
  };
};

module.exports = {
  listAllowlistEntries,
  isSuperAdminIpAllowed,
  recordAdminAuditLog,
  sendAdminLoginAlert,
  getSecurityOverview,
  resolveDeviceName,
  toBoolean,
};
