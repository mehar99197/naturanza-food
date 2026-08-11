const { isAdminUser } = require("./auth");

const requirePermission = (permission) => (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  if (String(req.user?.admin_role || "").toLowerCase() === "super_admin") {
    return next();
  }

  const permissions = Array.isArray(req.user?.admin_permissions)
    ? req.user.admin_permissions.map((value) => String(value).trim())
    : [];

  if (!permissions.includes(permission)) {
    return res.status(403).json({ error: "You do not have permission for this action" });
  }

  return next();
};

module.exports = requirePermission;
