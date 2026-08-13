const { db } = require("../config/db");
const { getTrustedClientIp } = require("../utils/rateLimitKey");
const { isSuperAdminIpAllowed } = require("../utils/adminSecurity");

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

module.exports = { enforceSuperAdminIpAllowlist };