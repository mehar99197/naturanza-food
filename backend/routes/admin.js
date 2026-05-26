const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { db } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const { issueAccessToken, verifyAccessToken, toExpiryDate } = require("../utils/jwtTokens");
const { blacklistAccessToken, revokeRefreshTokensByUserId } = require("../utils/tokenStore");
const { getAdminSettings, updateAdminSettings } = require("../utils/adminSettings");
const asyncHandler = require("../middleware/asyncHandler");
const newsletterController = require("../controllers/newsletterController");
const { syncDefaultAdminPassword } = require("../utils/envSync");
const {
  createUserSession,
  revokeSessionByToken,
  revokeSessionsByUserId,
} = require("../utils/sessionManager");
const { adminResetPasswordSchema } = require("../validation/authSchemas");
const {
  ensurePasswordHistoryTable,
  addPasswordToHistory,
  hasReusedPassword,
} = require("../utils/passwordHistory");
const {
  recordFailedLoginAtomic,
  resetLoginFailuresAtomic,
  checkAccountLockout,
} = require("../utils/loginSecurity");

const { toNullableString, toBoolean } = require("../utils/helpers");

const IP_LOOKUP_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "2000",
  10,
);
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const adminLoginLocationCache = new Map();
const LOGIN_MAX_ATTEMPTS =
  Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_LOCK_MINUTES =
  Number.parseInt(process.env.LOGIN_LOCK_MINUTES || "15", 10) || 15;

const isAccountLocked = (userRecord) => {
  const lockUntil = userRecord?.locked_until
    ? new Date(userRecord.locked_until)
    : null;

  if (!lockUntil || Number.isNaN(lockUntil.getTime())) {
    return false;
  }

  return lockUntil > new Date();
};

const markFailedLoginAttempt = async (userRecord) => {
  const currentAttempts = Number(userRecord?.failed_login_attempts || 0);
  const nextAttempt = currentAttempts + 1;
  const shouldLock = nextAttempt >= LOGIN_MAX_ATTEMPTS;

  await db
    .promise()
    .query(
      "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
      [
        shouldLock ? 0 : nextAttempt,
        shouldLock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) : null,
        userRecord.id,
      ],
    );
};

const resetLoginFailures = async (userId) => {
  await db
    .promise()
    .query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?",
      [userId],
    );
};

const normalizeIpAddress = (rawIp) => {
  let value = String(rawIp || "").trim();
  if (!value) {
    return null;
  }

  if (value.includes(",")) {
    value = value.split(",")[0].trim();
  }

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }

  if (value.includes("::ffff:")) {
    value = value.split("::ffff:").pop().trim();
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.split(":")[0];
  }

  if (value.toLowerCase() === "unknown") {
    return null;
  }

  return value;
};

const getRequestIp = (req) => {
  const candidates = [
    req.headers["cf-connecting-ip"],
    req.headers["x-real-ip"],
    req.headers["x-forwarded-for"],
    req.headers["x-client-ip"],
    req.ip,
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIpAddress(
      Array.isArray(candidate) ? candidate[0] : candidate,
    );
    if (normalized) {
      return normalized;
    }
  }

  return null;
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

const getCachedLocationForIp = (ipAddress) => {
  const cacheEntry = adminLoginLocationCache.get(ipAddress);
  if (!cacheEntry) {
    return null;
  }

  if (Date.now() - cacheEntry.timestamp > LOCATION_CACHE_TTL_MS) {
    adminLoginLocationCache.delete(ipAddress);
    return null;
  }

  return cacheEntry.location;
};

const setCachedLocationForIp = (ipAddress, location) => {
  adminLoginLocationCache.set(ipAddress, {
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

const resolveRequestLocation = async (req, ipAddress = null) => {
  const city = String(req.headers["x-city"] || req.headers["cf-ipcity"] || "").trim();
  const region = String(
    req.headers["x-region"] || req.headers["cf-region"] || "",
  ).trim();
  const country = String(
    req.headers["x-country"] ||
      req.headers["x-country-code"] ||
      req.headers["cf-ipcountry"] ||
      req.headers["x-vercel-ip-country"] ||
      "",
  ).trim();

  const parts = [city, region, country].filter(Boolean);
  if (parts.length) {
    return parts.join(", ");
  }

  return lookupLocationByIp(ipAddress || getRequestIp(req));
};

const recordAdminLoginHistorySafely = async ({
  req,
  userId = null,
  attemptedEmail = null,
  status = "failed",
  failureReason = null,
}) => {
  try {
    const normalizedStatus = status === "success" ? "success" : "failed";
    const ipAddress = getRequestIp(req);
    const locationLabel = await resolveRequestLocation(req, ipAddress);

    await db.promise().query(
      `INSERT INTO user_login_history
        (user_id, attempted_email, login_provider, ip_address, user_agent, device_name, location_label, status, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        attemptedEmail ? String(attemptedEmail).trim().toLowerCase() : null,
        "admin-password",
        ipAddress,
        req.headers["user-agent"] || null,
        resolveDeviceName(req.headers["user-agent"] || ""),
        locationLabel,
        normalizedStatus,
        normalizedStatus === "failed" ? failureReason || "Authentication failed" : null,
      ],
    );
  } catch (error) {
    // Keep admin auth deterministic even if history logging fails.
  }
};

const getBearerToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

const ALLOWED_PAYMENT_METHOD_CODES = new Set([
  "cod",
  "card",
  "online",
  "easypaisa",
  "jazzcash",
]);

// Shared login handler — parameterized so the super-admin route and the
// staff-admin route can enforce their own admin_role allowlist without
// duplicating 150+ lines of credential/lockout/session bookkeeping.
//
// allowedAdminRoles : Set<string>   admin_role values this gate accepts
// gateLabel         : string         used in failure-reason logs ('super_admin' | 'staff')
async function processAdminLogin(req, res, { allowedAdminRoles, gateLabel }) {
  const connection = await db.promise().getConnection();

  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!email || !password) {
      void recordAdminLoginHistorySafely({
        req,
        attemptedEmail: normalizedEmail || null,
        status: "failed",
        failureReason: "Missing credentials",
      });
      connection.release();
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const [results] = await connection.query(
      "SELECT * FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (results.length === 0) {
      void recordAdminLoginHistorySafely({
        req,
        attemptedEmail: normalizedEmail,
        status: "failed",
        failureReason: "Email not found",
      });
      connection.release();
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const user = results[0];

    if (!user.is_active) {
      void recordAdminLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        failureReason: "Account disabled",
      });
      connection.release();
      return res.status(403).json({
        success: false,
        error: "Account is disabled. Contact super admin.",
      });
    }

    const lockStatus = await checkAccountLockout(connection, user.id);
    if (lockStatus.locked) {
      connection.release();
      return res.status(423).json({
        success: false,
        error: "Account temporarily locked due to multiple failed attempts.",
      });
    }

    if (user.role !== "admin") {
      void recordAdminLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        failureReason: "Not an admin",
      });
      connection.release();
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    // Gate by admin_role. NULL admin_role used to fall back to 'super_admin',
    // which was a privilege-escalation footgun — every legacy admin would
    // pass the super-admin gate. Now NULL is treated as untyped and rejected
    // from both gates; super admins must have admin_role='super_admin' set.
    if (!allowedAdminRoles.has(String(user.admin_role || ""))) {
      void recordAdminLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        failureReason: `Wrong gate: ${user.admin_role || 'none'} not allowed via ${gateLabel}`,
      });
      connection.release();
      // Generic 403 — don't leak which gate the user belongs to.
      return res.status(403).json({
        success: false,
        error: gateLabel === "super_admin"
          ? "This portal is for super administrators only."
          : "This portal is for staff accounts only.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await recordFailedLoginAtomic(connection, user.id, user.email, true);
      const newLockStatus = await checkAccountLockout(connection, user.id);

      void recordAdminLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        failureReason: "Invalid password",
      });

      connection.release();

      if (newLockStatus.locked) {
        return res.status(423).json({
          success: false,
          error: "Account temporarily locked due to multiple failed attempts.",
        });
      }

      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        attemptsLeft: newLockStatus.attemptsLeft,
      });
    }

    await resetLoginFailuresAtomic(connection, user.id);
    connection.release();

    const accessToken = issueAccessToken(user);
    const token = accessToken.token;

    try {
      await createUserSession(db.promise(), {
        userId: user.id,
        token,
        provider: gateLabel === "super_admin" ? "admin-password" : "staff-password",
        ipAddress: getRequestIp(req),
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (sessionError) {
      console.error(
        "Could not persist admin session:",
        sessionError.message,
      );
    }

    void recordAdminLoginHistorySafely({
      req,
      userId: user.id,
      attemptedEmail: user.email,
      status: "success",
    });

    let adminPermissions = user.admin_permissions;
    if (typeof adminPermissions === 'string') {
      try {
        adminPermissions = JSON.parse(adminPermissions);
      } catch (e) {
        adminPermissions = null;
      }
    }

    return res.json({
      success: true,
      message: gateLabel === "super_admin" ? "Admin login successful" : "Staff login successful",
      token,
      accessTokenExpiresIn: accessToken.expiresInSeconds,
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        admin_role: user.admin_role, // no fallback — authoritative value from DB
        admin_permissions: adminPermissions,
        profile_image: user.profile_image || null,
      },
    });
  } catch (error) {
    try { connection.release(); } catch {}
    void recordAdminLoginHistorySafely({
      req,
      attemptedEmail: String(req.body?.email || "")
        .trim()
        .toLowerCase() || null,
      status: "failed",
      failureReason: "Server error",
    });
    return res.status(500).json({
      success: false,
      error: "Login failed due to a server error.",
    });
  }
}

const SUPER_ADMIN_ROLES = new Set(["super_admin"]);
const STAFF_ADMIN_ROLES = new Set(["staff_admin", "admin", "moderator"]);

// POST /api/admin/login — super admins only
router.post("/login", restrictBody('email', 'password'), (req, res) =>
  processAdminLogin(req, res, { allowedAdminRoles: SUPER_ADMIN_ROLES, gateLabel: "super_admin" })
);

// POST /api/admin/staff-login — staff admins / moderators only (not super admins)
router.post("/staff-login", restrictBody('email', 'password'), (req, res) =>
  processAdminLogin(req, res, { allowedAdminRoles: STAFF_ADMIN_ROLES, gateLabel: "staff" })
);

// Admin Verify Token - Requires authentication
router.get("/verify", authenticateToken, isAdmin, (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      admin_role: req.user.admin_role || 'super_admin',
      admin_permissions: req.user.admin_permissions,
      profile_image: req.user.profile_image || null,
    },
  });
});

// Admin Logout - Requires authentication
router.post("/logout", authenticateToken, isAdmin, restrictBody(), (req, res) => {
  const token = getBearerToken(req);

  const finalizeLogout = () => {
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  };

  if (!token) {
    finalizeLogout();
    return;
  }

  Promise.resolve()
    .then(async () => {
      try {
        const payload = verifyAccessToken(token);
        const expiryDate = toExpiryDate(payload);
        await blacklistAccessToken(db.promise(), {
          jti: payload.jti,
          userId: Number(payload.sub || 0) || null,
          token,
          expiresAt: expiryDate,
          reason: "admin_logout",
        });
      } catch (error) {
        // Token may already be expired.
      }

      await revokeSessionByToken(db.promise(), token);
    })
    .then(finalizeLogout)
    .catch(() => finalizeLogout());
});

// ============================================
// ADMIN FORGOT PASSWORD ENDPOINTS (No auth required)
// ============================================

const { sendEmail, sendPasswordResetEmail } = require("../utils/emailService");
const {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  invalidateAllUserTokens,
} = require("../utils/passwordResetTokens");

// Admin Forgot Password — works for super admin AND staff admins.
// To avoid email-enumeration, we return the same generic success response
// regardless of whether the address belongs to an admin in our system; the
// actual email is only dispatched when a matching admin row is found.
router.post("/forgot-password", restrictBody('email'), async (req, res) => {
  const genericSuccess = {
    success: true,
    message:
      "If that email belongs to an admin account, a password reset link has been sent.",
  };

  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const [users] = await db.promise().query(
      "SELECT id, name, email, role, admin_role, is_active FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    const admin = users[0];
    const isEligibleAdmin =
      admin &&
      String(admin.role || "").toLowerCase() === "admin" &&
      admin.is_active;

    if (!isEligibleAdmin) {
      // Don't reveal whether the email exists / is admin / is deactivated.
      return res.json(genericSuccess);
    }

    const tokenData = await createPasswordResetToken(
      db.promise(),
      admin.id,
      admin.email,
    );

    if (!tokenData || !tokenData.token) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate password reset link. Please try again.",
      });
    }

    const emailResult = await sendPasswordResetEmail(
      admin.email,
      admin.name,
      tokenData.token,
      true,
    );

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to send password reset email. Please try again later.",
      });
    }

    return res.json(genericSuccess);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "An error occurred. Please try again later.",
    });
  }
});

// Admin Reset Password — accepts any admin token (super or staff).
// The response includes a `redirect_to` field so the frontend can route the
// user to the correct login page (/admin/login for super_admin,
// /admin/staff-login for staff). Super admin login URL must not be revealed
// to staff users.
router.post("/reset-password", restrictBody('token', 'password', 'confirmPassword'), async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Reset token is required",
      });
    }

    const passwordValidation = adminResetPasswordSchema.safeParse(password);
    if (!passwordValidation.success) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.error.issues[0]?.message || "Password does not meet security requirements",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    const tokenValidation = await validatePasswordResetToken(db.promise(), token);

    if (!tokenValidation) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset link. Please request a new password reset.",
      });
    }

    if (!tokenValidation.valid) {
      return res.status(400).json({
        success: false,
        error:
          tokenValidation.reason ||
          "Invalid or expired reset link. Please request a new password reset.",
      });
    }

    const connection = await db.promise().getConnection();
    await ensurePasswordHistoryTable(connection);

    const [users] = await connection.query(
      "SELECT id, role, email, admin_role, password, is_active FROM users WHERE id = ?",
      [tokenValidation.userId]
    );

    const userRow = users[0];
    const userRole = String(userRow?.role || "").toLowerCase();
    const userAdminRole = String(userRow?.admin_role || "").toLowerCase();
    const isAdminUser = userRole === "admin";
    const isActiveAdmin = isAdminUser && userRow?.is_active;

    if (!userRow || !isActiveAdmin) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: "Invalid reset link. Please request a new password reset.",
      });
    }

    if (users[0].password) {
      const isSamePassword = await bcrypt.compare(password, users[0].password);
      if (isSamePassword) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: "New password must be different from your current password.",
        });
      }
    }

    const reusedPassword = await hasReusedPassword(connection, tokenValidation.userId, password, 5);
    if (reusedPassword) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: "You cannot reuse any of your last 5 passwords. Please choose a different password.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await connection.query(
      "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
      [hashedPassword, tokenValidation.userId]
    );

    await addPasswordToHistory(connection, tokenValidation.userId, password);

    connection.release();

    // Only mirror the super admin password back into the .env shim — staff
    // admin passwords are not stored there.
    if (userAdminRole === "super_admin") {
      try {
        await syncDefaultAdminPassword(userRow.email, password);
      } catch (envError) {
      }
    }

    await markTokenAsUsed(db.promise(), tokenValidation.tokenId);
    await invalidateAllUserTokens(db.promise(), tokenValidation.userId);
    await revokeSessionsByUserId(db.promise(), tokenValidation.userId);
    await revokeRefreshTokensByUserId(
      db.promise(),
      tokenValidation.userId,
      "password_reset",
    );

    // Tell the frontend which login page to send the user to next.
    // Super admin → /admin/login (kept private).
    // Everyone else (staff_admin / admin / moderator) → /admin/staff-login.
    const redirectTo =
      userAdminRole === "super_admin" ? "/admin/login" : "/admin/staff-login";

    res.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
      redirect_to: redirectTo,
      role: userAdminRole || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "An error occurred. Please try again later.",
    });
  }
});

// All other admin routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard statistics
router.get("/dashboard/stats", async (req, res) => {
  try {
    const [[userStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalUsers,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS activeUsers
             FROM users
             WHERE role = 'customer'`,
    );

    const [[productStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalProducts,
                SUM(CASE WHEN stock_quantity < 10 THEN 1 ELSE 0 END) AS lowStockProducts
             FROM products`,
    );

    const [[orderStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalOrders,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS totalRevenue,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processingOrders,
                SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shippedOrders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS deliveredOrders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders
             FROM orders
             WHERE payment_status = 'paid'`,
    );

    const [[contactStats]] = await db
      .promise()
      .query(
        'SELECT COUNT(*) AS newContacts FROM contacts WHERE status = "new"',
      );

    const [[returnStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalReturns,
                SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS pendingReturns,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refundedReturns
             FROM returns_requests`,
    );

    const [[refundStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalRefundTransactions,
                SUM(CASE WHEN status = 'processed' THEN amount ELSE 0 END) AS totalRefundAmount
             FROM refund_transactions`,
    );

    res.json({
      totalUsers: Number(userStats?.totalUsers || 0),
      activeUsers: Number(userStats?.activeUsers || 0),
      totalProducts: Number(productStats?.totalProducts || 0),
      lowStockProducts: Number(productStats?.lowStockProducts || 0),
      totalOrders: Number(orderStats?.totalOrders || 0),
      totalRevenue: Number(orderStats?.totalRevenue || 0),
      pendingOrders: Number(orderStats?.pendingOrders || 0),
      processingOrders: Number(orderStats?.processingOrders || 0),
      shippedOrders: Number(orderStats?.shippedOrders || 0),
      deliveredOrders: Number(orderStats?.deliveredOrders || 0),
      cancelledOrders: Number(orderStats?.cancelledOrders || 0),
      newContacts: Number(contactStats?.newContacts || 0),
      totalReturns: Number(returnStats?.totalReturns || 0),
      pendingReturns: Number(returnStats?.pendingReturns || 0),
      refundedReturns: Number(returnStats?.refundedReturns || 0),
      totalRefundTransactions: Number(
        refundStats?.totalRefundTransactions || 0,
      ),
      totalRefundAmount: Number(refundStats?.totalRefundAmount || 0),
    });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Recent orders
router.get("/dashboard/recent-orders", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const [results] = await db.promise().query(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.payment_status = 'paid'
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [limit]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Admin settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await getAdminSettings(db.promise());
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Could not load settings" });
  }
});

router.put("/settings", restrictBody('storeName', 'storeEmail', 'storePhone', 'currency', 'taxRate', 'shippingFlat', 'shippingFree', 'emailNotifications', 'orderNotifications', 'lowStockAlerts', 'lowStockThreshold', 'address', 'supportHours', 'facebookUrl', 'instagramUrl', 'twitterUrl', 'youtubeUrl', 'whatsappNumber', 'whatsappEnabled', 'mapLatitude', 'mapLongitude', 'mapLocationLabel', 'newsletterWelcomePromoCode'), async (req, res) => {
  try {
    const settings = await updateAdminSettings(db.promise(), req.body || {});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Could not update settings" });
  }
});

router.post("/settings/test-email", restrictBody('email'), async (req, res) => {
  try {
    const settings = await getAdminSettings(db.promise());
    const targetEmail = String(req.body?.email || settings.storeEmail || "").trim();

    if (!targetEmail) {
      return res.status(400).json({ error: "Email address is required" });
    }

    const subject = "Naturanza Admin Test Email";
    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h2 style="margin: 0 0 8px; color: #0f172a;">Test Email Successful</h2>
        <p style="margin: 0 0 12px;">This is a test email from your Naturanza admin settings.</p>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">Sent to ${targetEmail}</p>
      </div>
    `;

    const result = await sendEmail({
      to: targetEmail,
      subject,
      html,
    });

    if (!result?.success) {
      return res.status(500).json({ error: result?.error || "Failed to send email" });
    }

    res.json({ message: "Test email sent", messageId: result.messageId || null });
  } catch (error) {
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// Newsletter subscribers (admin)
router.get(
  "/newsletter/subscribers",
  asyncHandler(newsletterController.listSubscribers),
);

router.delete(
  "/newsletter/subscribers/:id",
  asyncHandler(newsletterController.deleteSubscriber),
);

router.post(
  "/newsletter/broadcast",
  restrictBody("subject", "message"),
  asyncHandler(newsletterController.broadcast),
);

router.post(
  "/newsletter/welcome-promo",
  restrictBody("code"),
  asyncHandler(newsletterController.setWelcomePromo),
);

// Sales report
router.get("/reports/sales", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders,
          SUM(total_amount) as revenue,
          AVG(total_amount) as average_order_value
      FROM orders
      WHERE status != 'cancelled'
        AND payment_status = 'paid'
    `;
    const params = [];

    if (start_date && end_date) {
      query += " AND created_at BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }

    query += " GROUP BY DATE(created_at) ORDER BY date DESC";

    const [results] = await db.promise().query(query, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Product sales report
router.get("/reports/products", async (req, res) => {
  try {
    const [results] = await db.promise().query(`
      SELECT 
          p.id, 
          p.name, 
          p.price,
          SUM(oi.quantity) as total_sold,
          SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
        AND o.payment_status = 'paid'
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 20
    `);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Reviews management
router.get("/reviews", async (req, res) => {
  try {
    const status = String(req.query.status || "all").trim().toLowerCase();
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 120, 1),
      500,
    );

    let whereClause = "";
    if (status === "approved") {
      whereClause = "WHERE r.is_approved = TRUE";
    } else if (status === "pending") {
      whereClause = "WHERE r.is_approved = FALSE";
    }

    const [rows] = await db.promise().query(
      `SELECT
          r.id,
          r.product_id,
          r.user_id,
          r.rating,
          r.comment,
          r.is_approved,
          r.created_at,
          p.name AS product_name,
          u.name AS customer_name,
          u.email AS customer_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [limit],
    );

    res.json(
      rows.map((review) => ({
        ...review,
        is_approved: Boolean(review.is_approved),
      })),
    );
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});


// DELETE review
router.delete("/reviews/:id", async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const [result] = await db.promise().query(
      "DELETE FROM reviews WHERE id = ?",
      [reviewId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  try {
    const includeAdmins = req.query.include_admins === "true";
    const [rows] = await db.promise().query(
      `SELECT
                u.id,
                u.name,
                u.email,
                u.phone,
                u.address,
                u.role,
                u.is_active,
                u.created_at,
                COUNT(DISTINCT o.id) AS orders_count,
                COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS total_spent
             FROM users u
             LEFT JOIN orders o ON o.user_id = u.id
               ${includeAdmins ? "" : "WHERE u.role = 'customer'"}
             GROUP BY u.id, u.name, u.email, u.phone, u.address, u.role, u.is_active, u.created_at
             ORDER BY u.created_at DESC`,
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Create user/customer
router.post("/users", restrictBody('name', 'email', 'password', 'phone', 'address', 'role', 'is_active'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      role = "customer",
      is_active = true,
    } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const normalizedRole = String(role).trim().toLowerCase();
    if (!["customer", "admin"].includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordToHash =
      toNullableString(password) ||
      `Temp@${Math.random().toString(36).slice(2, 10)}`;
    const hashedPassword = await bcrypt.hash(passwordToHash, 12);

    const [result] = await db.promise().query(
      `INSERT INTO users (name, email, password, phone, address, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        normalizedEmail,
        hashedPassword,
        toNullableString(phone),
        toNullableString(address),
        normalizedRole,
        toBoolean(is_active, true),
      ],
    );

    const [rows] = await db.promise().query(
      `SELECT id, name, email, phone, address, role, is_active, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
      [result.insertId],
    );

    res.status(201).json({
      message: "User created successfully",
      user: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    res.status(500).json({ error: "Error creating user" });
  }
});

// Update user profile details
router.put("/users/:id", restrictBody('name', 'email', 'phone', 'address'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { name, email, phone, address } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const [result] = await db.promise().query(
      `UPDATE users
             SET name = ?, email = ?, phone = ?, address = ?
             WHERE id = ?`,
      [
        String(name).trim(),
        String(email).trim().toLowerCase(),
        toNullableString(phone),
        toNullableString(address),
        userId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [rows] = await db.promise().query(
      `SELECT id, name, email, phone, address, role, is_active, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
      [userId],
    );

    res.json({
      message: "User updated successfully",
      user: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    res.status(500).json({ error: "Error updating user" });
  }
});

// Activate/deactivate user
router.patch("/users/:id/status", restrictBody('is_active'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ error: "Cannot change your own active status" });
    }

    const nextActive = toBoolean(req.body?.is_active, true);
    const [result] = await db
      .promise()
      .query("UPDATE users SET is_active = ? WHERE id = ?", [
        nextActive,
        userId,
      ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: `User ${nextActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating user status" });
  }
});

// Update user role
router.put("/users/:id/role", restrictBody('role'), async (req, res) => {
  const { role } = req.body;

  if (!["customer", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const [result] = await db
      .promise()
      .query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error updating user role" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    // Prevent self-deletion
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const [result] = await db.promise().query("DELETE FROM users WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting user" });
  }
});

// Low stock alert
router.get("/inventory/low-stock", async (req, res) => {
  try {
    const threshold = req.query.threshold || 10;
    const [results] = await db.promise().query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock_quantity < ?
      ORDER BY p.stock_quantity ASC
    `, [threshold]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Inventory movement history
router.get("/inventory/movements", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const productId = req.query.product_id
      ? parseInt(req.query.product_id, 10)
      : null;
    const orderId = req.query.order_id
      ? parseInt(req.query.order_id, 10)
      : null;

    const filters = [];
    const params = [];

    if (Number.isInteger(productId)) {
      filters.push("im.product_id = ?");
      params.push(productId);
    }

    if (Number.isInteger(orderId)) {
      filters.push("im.order_id = ?");
      params.push(orderId);
    }

    let query = `
            SELECT im.*, p.name AS product_name
            FROM inventory_movements im
            LEFT JOIN products p ON p.id = im.product_id
        `;

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(" AND ")}`;
    }

    query += " ORDER BY im.created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Tax rates
router.get("/tax-rates", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM tax_rates ORDER BY is_default DESC, updated_at DESC",
      );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/tax-rates", restrictBody('name', 'rate_percent', 'country', 'state', 'is_default', 'is_active'), async (req, res) => {
  try {
    const {
      name,
      rate_percent,
      country = "Pakistan",
      state = null,
      is_default = false,
      is_active = true,
    } = req.body || {};

    if (!name || rate_percent === undefined || rate_percent === null) {
      return res
        .status(400)
        .json({ error: "Tax rate name and rate_percent are required" });
    }

    if (Number(is_default)) {
      await db
        .promise()
        .query("UPDATE tax_rates SET is_default = FALSE WHERE country = ?", [
          country,
        ]);
    }

    const [result] = await db.promise().query(
      `INSERT INTO tax_rates (name, rate_percent, country, state, is_default, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        Number(rate_percent),
        country,
        state,
        Boolean(is_default),
        Boolean(is_active),
      ],
    );

    const [rows] = await db
      .promise()
      .query("SELECT * FROM tax_rates WHERE id = ?", [result.insertId]);

    res.status(201).json({
      message: "Tax rate created successfully",
      taxRate: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Error creating tax rate" });
  }
});

router.put("/tax-rates/:id", restrictBody('name', 'rate_percent', 'country', 'state', 'is_default', 'is_active'), async (req, res) => {
  try {
    const {
      name,
      rate_percent,
      country = "Pakistan",
      state = null,
      is_default = false,
      is_active = true,
    } = req.body || {};

    if (!name || rate_percent === undefined || rate_percent === null) {
      return res
        .status(400)
        .json({ error: "Tax rate name and rate_percent are required" });
    }

    if (Number(is_default)) {
      await db
        .promise()
        .query(
          "UPDATE tax_rates SET is_default = FALSE WHERE country = ? AND id != ?",
          [country, req.params.id],
        );
    }

    const [result] = await db.promise().query(
      `UPDATE tax_rates
             SET name = ?, rate_percent = ?, country = ?, state = ?, is_default = ?, is_active = ?
             WHERE id = ?`,
      [
        String(name).trim(),
        Number(rate_percent),
        country,
        state,
        Boolean(is_default),
        Boolean(is_active),
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT * FROM tax_rates WHERE id = ?", [req.params.id]);

    res.json({
      message: "Tax rate updated successfully",
      taxRate: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating tax rate" });
  }
});

router.delete("/tax-rates/:id", async (req, res) => {
  try {
    const taxRateId = Number(req.params.id);
    if (!Number.isInteger(taxRateId)) {
      return res.status(400).json({ error: "Invalid tax rate id" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT is_default FROM tax_rates WHERE id = ? LIMIT 1", [
        taxRateId,
      ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    if (rows[0].is_default) {
      return res.status(400).json({
        error: "Default tax rate cannot be deleted. Set another default first.",
      });
    }

    await db.promise().query("DELETE FROM tax_rates WHERE id = ?", [taxRateId]);
    res.json({ message: "Tax rate deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting tax rate" });
  }
});

// Payment methods management
router.get("/payment-methods", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT *
             FROM payment_methods
             ORDER BY sort_order ASC, created_at ASC`,
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/payment-methods", restrictBody('code', 'label', 'description', 'sort_order', 'supports_online', 'is_active'), async (req, res) => {
  try {
    const {
      code,
      label,
      description,
      sort_order = 0,
      supports_online = false,
      is_active = true,
    } = req.body || {};

    const normalizedCode = String(code || "")
      .trim()
      .toLowerCase();
    const normalizedLabel = String(label || "").trim();

    if (!normalizedCode || !normalizedLabel) {
      return res
        .status(400)
        .json({ error: "Payment method code and label are required" });
    }

    if (!ALLOWED_PAYMENT_METHOD_CODES.has(normalizedCode)) {
      return res.status(400).json({
        error: "Invalid payment method code for current order schema",
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO payment_methods
             (code, label, description, sort_order, supports_online, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        normalizedCode,
        normalizedLabel,
        toNullableString(description),
        Number(sort_order) || 0,
        toBoolean(supports_online, false),
        toBoolean(is_active, true),
      ],
    );

    const [rows] = await db
      .promise()
      .query("SELECT * FROM payment_methods WHERE id = ? LIMIT 1", [
        result.insertId,
      ]);

    res.status(201).json({
      message: "Payment method created successfully",
      paymentMethod: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Payment method code already exists" });
    }

    res.status(500).json({ error: "Error creating payment method" });
  }
});

router.put("/payment-methods/:id", restrictBody('code', 'label', 'description', 'sort_order', 'supports_online', 'is_active'), async (req, res) => {
  try {
    const paymentMethodId = Number(req.params.id);
    if (!Number.isInteger(paymentMethodId)) {
      return res.status(400).json({ error: "Invalid payment method id" });
    }

    const {
      code,
      label,
      description,
      sort_order = 0,
      supports_online = false,
      is_active = true,
    } = req.body || {};

    const normalizedCode = String(code || "")
      .trim()
      .toLowerCase();
    const normalizedLabel = String(label || "").trim();

    if (!normalizedCode || !normalizedLabel) {
      return res
        .status(400)
        .json({ error: "Payment method code and label are required" });
    }

    if (!ALLOWED_PAYMENT_METHOD_CODES.has(normalizedCode)) {
      return res.status(400).json({
        error: "Invalid payment method code for current order schema",
      });
    }

    const [result] = await db.promise().query(
      `UPDATE payment_methods
             SET code = ?,
                 label = ?,
                 description = ?,
                 sort_order = ?,
                 supports_online = ?,
                 is_active = ?
             WHERE id = ?`,
      [
        normalizedCode,
        normalizedLabel,
        toNullableString(description),
        Number(sort_order) || 0,
        toBoolean(supports_online, false),
        toBoolean(is_active, true),
        paymentMethodId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT * FROM payment_methods WHERE id = ? LIMIT 1", [
        paymentMethodId,
      ]);

    res.json({
      message: "Payment method updated successfully",
      paymentMethod: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Payment method code already exists" });
    }

    res.status(500).json({ error: "Error updating payment method" });
  }
});

router.delete("/payment-methods/:id", async (req, res) => {
  try {
    const paymentMethodId = Number(req.params.id);
    if (!Number.isInteger(paymentMethodId)) {
      return res.status(400).json({ error: "Invalid payment method id" });
    }

    const [result] = await db
      .promise()
      .query("DELETE FROM payment_methods WHERE id = ?", [paymentMethodId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting payment method" });
  }
});

// Returns management
router.get("/returns", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status ? String(req.query.status).trim() : null;

    let query = `
            SELECT rr.*, u.name AS user_name, u.email AS user_email,
                   o.total_amount, o.status AS order_status
            FROM returns_requests rr
            JOIN users u ON u.id = rr.user_id
            JOIN orders o ON o.id = rr.order_id
        `;
    const params = [];

    if (status) {
      query += " WHERE rr.status = ?";
      params.push(status);
    }

    query += " ORDER BY rr.created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.put("/returns/:id/status", restrictBody('status', 'note', 'refund_amount', 'method', 'reference_number'), async (req, res) => {
  const { status, note, refund_amount, method, reference_number } =
    req.body || {};
  const allowedStatuses = new Set([
    "requested",
    "approved",
    "rejected",
    "received",
    "refunded",
  ]);

  if (!allowedStatuses.has(String(status || "").trim())) {
    return res.status(400).json({ error: "Invalid return status" });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM returns_requests WHERE id = ? FOR UPDATE",
      [req.params.id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Return request not found" });
    }

    const request = rows[0];

    await connection.query(
      `UPDATE returns_requests
             SET status = ?, reviewed_by_user_id = ?, reviewed_at = NOW(), details = CONCAT(IFNULL(details, ''), ?)
             WHERE id = ?`,
      [
        status,
        req.user.id,
        note ? `\nAdmin note: ${String(note).trim()}` : "",
        req.params.id,
      ],
    );

    if (status === "refunded") {
      const refundAmount = Number(
        refund_amount || request.requested_amount || 0,
      );

      if (!(refundAmount > 0)) {
        await connection.rollback();
        return res.status(400).json({
          error: "Valid refund amount is required for refunded status",
        });
      }

      await connection.query(
        `INSERT INTO refund_transactions
                 (return_request_id, order_id, user_id, amount, method, status, reference_number, notes, processed_by_user_id, processed_at)
                 VALUES (?, ?, ?, ?, ?, 'processed', ?, ?, ?, NOW())`,
        [
          request.id,
          request.order_id,
          request.user_id,
          refundAmount,
          method || "manual",
          reference_number || null,
          note || null,
          req.user.id,
        ],
      );

      await connection.query(
        `INSERT INTO payment_transactions
                 (order_id, user_id, transaction_type, provider, amount, status, gateway_reference, payload, processed_at)
                 VALUES (?, ?, 'refund', ?, ?, 'refunded', ?, ?, NOW())`,
        [
          request.order_id,
          request.user_id,
          method || "manual",
          refundAmount,
          reference_number || null,
          JSON.stringify({ return_request_id: request.id, note: note || null }),
        ],
      );
    }

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, payload)
             VALUES (?, 'return_update', 'Return Request Updated', ?, ?)`,
      [
        request.user_id,
        `Your return request #${request.id} is now ${status}.`,
        JSON.stringify({ return_request_id: request.id, status }),
      ],
    );

    await connection.commit();
    res.json({ message: "Return request updated successfully" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: "Error updating return request" });
  } finally {
    connection.release();
  }
});

// QR code data for a product
router.get("/products/:id/qr-data", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const [rows] = await db.promise().query(
      "SELECT id, name, slug, qr_code_url FROM products WHERE id = ? LIMIT 1",
      [productId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = rows[0];
    const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    const productUrl = product.qr_code_url || `${frontendUrl}/product/${product.id}`;

    res.json({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productUrl,
    });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

