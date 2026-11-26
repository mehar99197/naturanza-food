const { enforceSuperAdminIpAllowlist } = require('./adminIpAllowlist');

// Middleware to ensure only super_admin can access certain routes
function requireSuperAdmin(req, res, next) {
  // Check if user is authenticated and is a super admin
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (String(req.user.admin_role || '').toLowerCase() !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  return enforceSuperAdminIpAllowlist(req, res, next);
}

module.exports = requireSuperAdmin;
