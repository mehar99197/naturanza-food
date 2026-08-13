const { db } = require("../config/db");
const { getTrustedClientIp } = require("../utils/rateLimitKey");
const { getClientIp } = require("../utils/clientIp");
const { isSuperAdminIpAllowed, listAllowlistEntries } = require("../utils/adminSecurity");
const { ipMatchesCidr } = require("../utils/ipAllowlist");

// Enforce the allowlist on every authenticated super-admin request, not only
// at login. This closes an existing-session bypass after the allowlist changes
// or when a device moves to a different network.
const enforceSuperAdminIpAllowlist = async (req, res, next) => {
  if (String(req.user?.role || "").toLowerCase() !== "admin") {
    return next();
  }
  if (String(req.user?.admin_role || "").toLowerCase() !== "super_admin") {
    return next();
  }

  const ipAddress = getTrustedClientIp(req);
  try {
    const allowed = await isSuperAdminIpAllowed({
      ipAddress,
      database: db.promise(),
    });
    if (allowed) {
      return next();
    }
  } catch {
    // If an enabled security control cannot be checked, fail closed.
  }

  return res.status(403).json({
    error: "Access denied: this network is not permitted for super admin access.",
    code: "SUPER_ADMIN_IP_NOT_ALLOWED",
  });
};

// General admin-panel IP gate, applied globally to /api/admin* in index.js.
// Unlike `enforceSuperAdminIpAllowlist` (which only gates super admins on the
// Security Center routes), this gate protects EVERY admin API for EVERY admin/
// staff role: once the allowlist contains at least one entry, only allowlisted
// networks can reach any admin API. An empty allowlist disables the feature
// (no lockout on fresh installs). Auth-only endpoints and the gate-check
// endpoint are exempt so a blocked user can still log in and then see the
// frontend warning page rather than being silently 403-ed.
const ADMIN_ALLOWLIST_CACHE_TTL_MS = 10000; // 10s — short so management edits propagate quickly without a DB hit per request.
let adminAllowlistCache = null; // { entries: Array, expiresAt: Number }

const ADMIN_IP_EXEMPT_RELATIVE_PATHS = new Set([
  "/login",
  "/staff-login",
  "/verify",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/security/ip-access",
]);

const readAdminAllowlist = async () => {
  const now = Date.now();
  if (adminAllowlistCache && now < adminAllowlistCache.expiresAt) {
    return adminAllowlistCache.entries;
  }
  try {
    const entries = await listAllowlistEntries();
    adminAllowlistCache = { entries, expiresAt: now + ADMIN_ALLOWLIST_CACHE_TTL_MS };
    return entries;
  } catch (error) {
    // Serve a stale copy if we have one — this keeps the panel gated during a
    // transient DB hiccup instead of falling back to "feature disabled".
    if (adminAllowlistCache?.entries) {
      return adminAllowlistCache.entries;
    }
    throw error;
  }
};

const enforceAdminIpAllowlist = async (req, res, next) => {
  const relativePath = String(req.path || "");
  if (ADMIN_IP_EXEMPT_RELATIVE_PATHS.has(relativePath)) {
    return next();
  }

  let entries;
  try {
    entries = await readAdminAllowlist();
  } catch (error) {
    // Could not load the allowlist and have no stale copy. Fail open to avoid a
    // full admin-panel outage during a transient DB issue; the per-route
    // authenticateToken/isAdmin checks still protect these endpoints identity-wise.
    console.warn(
      "[adminIpAllowlist] Could not load admin allowlist — failing open:",
      error?.message || error,
    );
    return next();
  }

  if (!entries || entries.length === 0) {
    return next(); // feature disabled (no entries configured)
  }

  const currentIp = getTrustedClientIp(req) || getClientIp(req) || null;
  const allowed = currentIp
    ? entries.some((entry) => ipMatchesCidr(currentIp, entry.cidr))
    : false;

  if (!allowed) {
    return res.status(403).json({
      error: "Access denied: this IP address is not permitted to access the admin panel.",
      code: "ADMIN_IP_NOT_ALLOWED",
    });
  }

  return next();
};

module.exports = { enforceSuperAdminIpAllowlist, enforceAdminIpAllowlist };