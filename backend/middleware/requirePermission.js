/**
 * Granular admin permission enforcement.
 *
 * `isAdmin` only proves `role === 'admin'`, which every staff_admin satisfies.
 * The per-feature grants stored in `users.admin_permissions` were previously
 * honoured by the React sidebar/route guards alone, so a staff admin holding a
 * single grant could still call every other admin endpoint directly with their
 * own valid token. This middleware moves that decision server-side.
 *
 * Rules mirror the frontend exactly (see
 * ../../frontend/src/config/adminPermissions.js):
 *   - super_admin passes everything
 *   - a staff admin passes only when the key is present in admin_permissions
 *   - `requireSuperAdmin` (separate middleware) still guards super-admin-only areas
 *
 * Keep PERMISSION_KEYS in sync with the frontend PERMISSION_LIST.
 */

const PERMISSION_KEYS = new Set([
  "manage_products",
  "manage_categories",
  "manage_coupons",
  "manage_reviews",
  "manage_orders",
  "manage_returns",
  "manage_customers",
  "manage_messages",
  "manage_subscribers",
  "view_reports",
  "view_analytics",
  "manage_shipping",
  "manage_shipping_cities",
  "manage_payments",
  "manage_announcements",
  "manage_blog",
  "manage_team",
]);

const isSuperAdmin = (user) =>
  String(user?.admin_role || "").trim().toLowerCase() === "super_admin";

// admin_permissions is a JSON column; middleware/auth.js already parses strings,
// but tolerate both shapes so a legacy row can't crash the guard.
const readGrantedPermissions = (user) => {
  const raw = user?.admin_permissions;

  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry).trim().toLowerCase());
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((entry) => String(entry).trim().toLowerCase())
        : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const hasPermission = (user, permissionKey) => {
  if (isSuperAdmin(user)) {
    return true;
  }

  return readGrantedPermissions(user).includes(permissionKey);
};

/**
 * Guard a route with a single permission key.
 * Must run after `authenticateToken` + `isAdmin`.
 */
const requirePermission = (permissionKey) => {
  if (!PERMISSION_KEYS.has(permissionKey)) {
    // Fail loudly at wiring time rather than silently allowing everything.
    throw new Error(`Unknown admin permission key: ${permissionKey}`);
  }

  // Named so it is identifiable in stack traces and in router-stack assertions.
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (String(req.user.role || "").trim().toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action",
        requiredPermission: permissionKey,
      });
    }

    return next();
  };
};

/**
 * Guard a route that any one of several permissions may unlock (e.g. an
 * endpoint shared by the Orders and Returns screens).
 */
const requireAnyPermission = (...permissionKeys) => {
  permissionKeys.forEach((key) => {
    if (!PERMISSION_KEYS.has(key)) {
      throw new Error(`Unknown admin permission key: ${key}`);
    }
  });

  return function requireAnyPermissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (String(req.user.role || "").trim().toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!permissionKeys.some((key) => hasPermission(req.user, key))) {
      return res.status(403).json({
        error: "You do not have permission to perform this action",
        requiredPermission: permissionKeys.join(" or "),
      });
    }

    return next();
  };
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  hasPermission,
  isSuperAdmin,
  PERMISSION_KEYS,
};
