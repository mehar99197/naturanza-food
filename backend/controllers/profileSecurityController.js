const bcrypt = require("bcryptjs");
const { db } = require("../config/db");
const { hashToken } = require("../utils/sessionManager");
const { revokeRefreshTokensBySessionId } = require("../utils/tokenStore");

const IP_LOOKUP_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "2000",
  10,
);
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const loginHistoryLocationCache = new Map();

const toSessionId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveDeviceName = (userAgent = "") => {
  const ua = String(userAgent || "");
  const lowered = ua.toLowerCase();

  if (!ua) {
    return "Unknown Device";
  }

  const browser =
    lowered.includes("edg/")
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

  const device =
    lowered.includes("android")
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

const normalizeIpForDisplay = (rawIp) => {
  let ip = String(rawIp || "").trim();
  if (!ip) {
    return null;
  }

  if (ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  if (ip.includes("::ffff:")) {
    ip = ip.split("::ffff:").pop().trim();
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(":")[0];
  }

  return ip || null;
};

const isPrivateOrLocalIp = (ipAddress) => {
  const ip = String(ipAddress || "").trim().toLowerCase();
  if (!ip) {
    return true;
  }

  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "localhost") {
    return true;
  }

  if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return true;
  }

  if (ip.startsWith("169.254.")) {
    return true;
  }

  const private172 = ip.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) {
    return true;
  }

  return false;
};

const normalizeLocationForDisplay = (locationLabel, ipAddress) => {
  const location = String(locationLabel || "").trim();
  if (location && location.toLowerCase() !== "unknown") {
    return location;
  }

  if (isPrivateOrLocalIp(ipAddress)) {
    return "Local Network";
  }

  return "Unknown";
};

const getCachedLocationForIp = (ipAddress) => {
  const cacheEntry = loginHistoryLocationCache.get(ipAddress);
  if (!cacheEntry) {
    return null;
  }

  if (Date.now() - cacheEntry.timestamp > LOCATION_CACHE_TTL_MS) {
    loginHistoryLocationCache.delete(ipAddress);
    return null;
  }

  return cacheEntry.location;
};

const setCachedLocationForIp = (ipAddress, location) => {
  loginHistoryLocationCache.set(ipAddress, {
    location,
    timestamp: Date.now(),
  });
};

const lookupLocationByIp = async (ipAddress) => {
  if (!ipAddress || isPrivateOrLocalIp(ipAddress)) {
    return "Local Network";
  }

  const cachedLocation = getCachedLocationForIp(ipAddress);
  if (cachedLocation) {
    return cachedLocation;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(
        `https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`,
        {
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return "Unknown";
    }

    const data = await response.json();
    const city = String(data?.city || "").trim();
    const region = String(data?.region || "").trim();
    const country = String(data?.country_name || data?.country || "").trim();
    const location = [city, region, country].filter(Boolean).join(", ") || "Unknown";

    if (location !== "Unknown") {
      setCachedLocationForIp(ipAddress, location);
    }

    return location;
  } catch (error) {
    return "Unknown";
  }
};

const resolveLoginHistoryLocation = async ({ row, ipAddress }) => {
  const normalizedLocation = normalizeLocationForDisplay(row.location_label, ipAddress);
  if (normalizedLocation !== "Unknown") {
    return normalizedLocation;
  }

  const lookedUpLocation = await lookupLocationByIp(ipAddress);

  if (lookedUpLocation !== "Unknown") {
    try {
      await db.promise().query(
        `UPDATE user_login_history
         SET location_label = ?
         WHERE id = ?
           AND (location_label IS NULL OR location_label = '' OR LOWER(location_label) = 'unknown')`,
        [lookedUpLocation, row.id],
      );
    } catch (error) {
      // Keep endpoint resilient even when write-back fails.
    }
  }

  return lookedUpLocation;
};

const getPasswordPolicyErrors = (password) => {
  const value = String(password || "");
  const errors = [];

  if (value.length < 12) {
    errors.push("Password must be at least 12 characters long.");
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("Password must include at least one uppercase letter.");
  }
  if (!/[a-z]/.test(value)) {
    errors.push("Password must include at least one lowercase letter.");
  }
  if (!/[0-9]/.test(value)) {
    errors.push("Password must include at least one number.");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push("Password must include at least one special character.");
  }

  return errors;
};

const getCurrentSessionId = async ({ userId, token }) => {
  if (!userId || !token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const [rows] = await db.promise().query(
    "SELECT id FROM user_sessions WHERE user_id = ? AND token_hash = ? LIMIT 1",
    [userId, tokenHash],
  );

  return rows[0]?.id || null;
};

const changePassword = async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const confirmNewPassword = String(req.body?.confirmNewPassword || "");

  if (!newPassword || !confirmNewPassword) {
    return res.status(400).json({
      error: "New password and confirm password are required.",
    });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({
      error: "New password and confirm password do not match.",
    });
  }

  const passwordPolicyErrors = getPasswordPolicyErrors(newPassword);
  if (passwordPolicyErrors.length > 0) {
    return res.status(400).json({
      error: "Password does not meet the security requirements.",
      details: passwordPolicyErrors,
    });
  }

  const [users] = await db
    .promise()
    .query(
      "SELECT password, signup_provider, password_set_by_user FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );

  if (!users.length) {
    return res.status(404).json({ error: "User not found" });
  }

  const userRecord = users[0];
  const requiresCurrentPasswordByFlag =
    userRecord.password_set_by_user === null ||
    typeof userRecord.password_set_by_user === "undefined"
      ? true
      : Boolean(Number(userRecord.password_set_by_user));

  let currentLoginProvider = "password";
  if (req.token) {
    const tokenHash = hashToken(req.token);
    const [sessionRows] = await db.promise().query(
      "SELECT login_provider FROM user_sessions WHERE user_id = ? AND token_hash = ? LIMIT 1",
      [req.user.id, tokenHash],
    );

    currentLoginProvider = String(sessionRows[0]?.login_provider || "password")
      .trim()
      .toLowerCase();
  }

  const isSocialSession = currentLoginProvider === "google";

  const requiresCurrentPassword =
    requiresCurrentPasswordByFlag && !isSocialSession;

  const isFirstTimePasswordSetup = !requiresCurrentPasswordByFlag;

  if (requiresCurrentPassword && !currentPassword) {
    return res.status(400).json({
      error: "Current password is required for this account.",
    });
  }

  if (requiresCurrentPassword && currentPassword === newPassword) {
    return res.status(400).json({
      error: "New password must be different from current password.",
    });
  }

  if (requiresCurrentPassword) {
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      userRecord.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await db
    .promise()
    .query(
      "UPDATE users SET password = ?, password_set_by_user = TRUE WHERE id = ?",
      [hashedPassword, req.user.id],
    );

  return res.json({
    message: isFirstTimePasswordSetup
      ? "Password set successfully. You can now sign in with email and password too."
      : "Password updated successfully.",
    requiresCurrentPassword: true,
  });
};

const getLoginHistory = async (req, res) => {
  const [rows] = await db.promise().query(
    `SELECT
        id,
        created_at,
        device_name,
        user_agent,
        ip_address,
        location_label,
        status,
        login_provider,
        failure_reason
      FROM user_login_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10`,
    [req.user.id],
  );

  const items = await Promise.all(
    rows.map(async (row) => {
      const normalizedIp = normalizeIpForDisplay(row.ip_address);
      const location = await resolveLoginHistoryLocation({
        row,
        ipAddress: normalizedIp,
      });

      return {
        id: row.id,
        dateTime: row.created_at,
        device: row.device_name || resolveDeviceName(row.user_agent),
        ipAddress: normalizedIp || "Unknown",
        location,
        status: row.status === "success" ? "success" : "failed",
        provider: row.login_provider || "password",
        reason: row.failure_reason || null,
      };
    }),
  );

  return res.json({
    items,
  });
};

const getActiveSessions = async (req, res) => {
  const tokenHash = hashToken(req.token || "");

  const [rows] = await db.promise().query(
    `SELECT
        id,
        ip_address,
        user_agent,
        login_provider,
        created_at,
        last_seen_at,
        revoked_at,
        is_active,
        CASE WHEN token_hash = ? THEN TRUE ELSE FALSE END AS is_current
      FROM user_sessions
      WHERE user_id = ? AND is_active = TRUE
      ORDER BY is_current DESC, COALESCE(last_seen_at, created_at) DESC`,
    [tokenHash, req.user.id],
  );

  return res.json({
    items: rows.map((row) => {
      const normalizedIp = normalizeIpForDisplay(row.ip_address);

      return {
        id: row.id,
        device: resolveDeviceName(row.user_agent),
        browser: row.login_provider || "password",
        ipAddress: normalizedIp || "Unknown",
        loginTime: row.created_at,
        lastActive: row.last_seen_at || row.created_at,
        isCurrent: Boolean(row.is_current),
      };
    }),
  });
};

const logoutDevice = async (req, res) => {
  const sessionId = toSessionId(req.params.sessionId);

  if (!sessionId) {
    return res.status(400).json({ error: "Invalid session id." });
  }

  const currentSessionId = await getCurrentSessionId({
    userId: req.user.id,
    token: req.token,
  });

  if (currentSessionId && Number(currentSessionId) === Number(sessionId)) {
    return res.status(400).json({
      error: "You cannot logout your current session from this action.",
    });
  }

  const [result] = await db.promise().query(
    `UPDATE user_sessions
     SET is_active = FALSE,
         revoked_at = NOW(),
         last_seen_at = NOW()
     WHERE id = ? AND user_id = ? AND is_active = TRUE`,
    [sessionId, req.user.id],
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Session not found." });
  }

  await revokeRefreshTokensBySessionId(
    db.promise(),
    sessionId,
    "logout_device",
  );

  return res.json({ message: "Device logged out successfully." });
};

const logoutAllOtherDevices = async (req, res) => {
  const currentSessionId = await getCurrentSessionId({
    userId: req.user.id,
    token: req.token,
  });

  const params = [req.user.id];
  let sql =
    `SELECT id
     FROM user_sessions
     WHERE user_id = ? AND is_active = TRUE`;

  if (currentSessionId) {
    sql += " AND id <> ?";
    params.push(currentSessionId);
  }

  const [sessionRows] = await db.promise().query(sql, params);
  const revokeSessionIds = sessionRows.map((row) => row.id).filter(Boolean);

  const updateParams = [req.user.id];
  let updateSql =
    `UPDATE user_sessions
     SET is_active = FALSE,
         revoked_at = NOW(),
         last_seen_at = NOW()
     WHERE user_id = ? AND is_active = TRUE`;

  if (currentSessionId) {
    updateSql += " AND id <> ?";
    updateParams.push(currentSessionId);
  }

  const [result] = await db.promise().query(updateSql, updateParams);

  for (const sessionId of revokeSessionIds) {
    await revokeRefreshTokensBySessionId(
      db.promise(),
      sessionId,
      "logout_all_other_devices",
    );
  }

  return res.json({
    message: "Logged out from all other devices.",
    revokedSessions: result.affectedRows || 0,
  });
};

const deleteAccount = async (req, res) => {
  const confirmationText = String(req.body?.confirmationText || "").trim();
  const currentPassword = String(req.body?.currentPassword || "");

  if (confirmationText.toUpperCase() !== "DELETE") {
    return res.status(400).json({
      error: "Type DELETE to confirm account deletion.",
    });
  }

  const [users] = await db
    .promise()
    .query(
      "SELECT id, email, password, role, password_set_by_user FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );

  if (!users.length) {
    return res.status(404).json({ error: "User not found." });
  }

  const userRecord = users[0];
  const role = String(userRecord.role || "").trim().toLowerCase();
  if (role === "admin") {
    return res.status(403).json({
      error: "Admin accounts cannot be deleted from this screen.",
    });
  }

  if (!currentPassword) {
    return res.status(400).json({
      error: "Current password is required to delete your account.",
    });
  }

  if (!userRecord.password) {
    return res.status(400).json({
      error: "Current password is required. Please set your password first and try again.",
    });
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    String(userRecord.password || ""),
  );

  if (!isPasswordValid) {
    return res.status(401).json({
      error: "Current password is incorrect.",
    });
  }

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const [deleteResult] = await connection.query(
      "DELETE FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );

    if (!deleteResult.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found." });
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return res.json({
    message: "Your account has been permanently deleted.",
  });
};

module.exports = {
  changePassword,
  getLoginHistory,
  getActiveSessions,
  logoutDevice,
  logoutAllOtherDevices,
  deleteAccount,
};
