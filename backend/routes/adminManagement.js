const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { restrictBody } = require('../middleware/security');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const upload = require('../middleware/uploadConfig');
const { uploadProfileImage } = require('../middleware/upload');
const { generateSecurePassword, logAdminAction, getClientIP } = require('../utils/adminHelpers');
const { createPasswordResetToken } = require('../utils/passwordResetTokens');
const { sendPasswordResetEmail } = require('../utils/emailService');
const { revokeSessionsByUserId, touchSessionByToken } = require('../utils/sessionManager');
const { revokeRefreshTokensByUserId } = require('../utils/tokenStore');
const { syncDefaultAdminPassword } = require('../utils/envSync');
const { hasReusedPassword, addPasswordToHistory } = require('../utils/passwordHistory');

const parseEnumValues = (enumDefinition = "") => {
  const match = String(enumDefinition).match(/^enum\((.*)\)$/i);
  if (!match || !match[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((entry) => entry.trim().replace(/^'(.*)'$/, "$1"))
    .filter(Boolean);
};

const getAllowedAdminRoles = async (connection) => {
  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM users LIKE 'admin_role'");
    const columnType = rows?.[0]?.Type || rows?.[0]?.type || "";
    const values = parseEnumValues(columnType);
    return new Set(values.map((value) => value.toLowerCase()));
  } catch (error) {
    return new Set();
  }
};

const resolveAdminRole = async (connection, desiredRole) => {
  const normalizedRole = String(desiredRole || "staff_admin").trim().toLowerCase();
  const allowedRoles = await getAllowedAdminRoles(connection);

  if (!allowedRoles.size) {
    return normalizedRole || "staff_admin";
  }

  if (allowedRoles.has(normalizedRole)) {
    return normalizedRole;
  }

  if (normalizedRole === "staff_admin") {
    if (allowedRoles.has("admin")) return "admin";
    if (allowedRoles.has("moderator")) return "moderator";
  }

  if (allowedRoles.has("staff_admin")) return "staff_admin";
  if (allowedRoles.has("admin")) return "admin";
  if (allowedRoles.has("moderator")) return "moderator";
  if (allowedRoles.has("super_admin")) return "super_admin";

  return normalizedRole;
};

// GET /api/admin-management/admins - Get all admins with filters
router.get('/admins', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, role, search } = req.query;
    const isRequesterSuperAdmin = req.user.admin_role === 'super_admin';
    const staffRoles = ['staff_admin', 'admin', 'moderator'];
    
    let query = `
            SELECT id, name, email, phone, role, admin_role, admin_permissions,
              is_active, last_login, profile_image, created_at
      FROM users
      WHERE role = 'admin'
    `;
    const params = [];

    // Staff admin should not see super admin accounts
    if (!isRequesterSuperAdmin) {
      query += ` AND admin_role IN (${staffRoles.map(() => '?').join(', ')})`;
      params.push(...staffRoles);
    }

    if (status === 'active') {
      query += ' AND is_active = true';
    } else if (status === 'inactive') {
      query += ' AND is_active = false';
    }

    if (role === 'super_admin') {
      query += ' AND admin_role = ?';
      params.push('super_admin');
    } else if (role === 'staff_admin') {
      query += ` AND admin_role IN (${staffRoles.map(() => '?').join(', ')})`;
      params.push(...staffRoles);
    }

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const [admins] = await db.promise().query(query, params);
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// POST /api/admin-management/admins - Create new admin
router.post('/admins', authenticateToken, isAdmin, upload.single('profile_picture'), async (req, res) => {
  try {
    // Allow any admin for testing
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { full_name, email, phone, role, permissions } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Look up any existing user with this email. Three cases:
    //   - active admin     → genuine conflict, reject
    //   - customer / demoted admin → re-promote (preserves orders + history)
    //   - no row at all    → create fresh
    const [existing] = await db.promise().query(
      'SELECT id, role, admin_role, is_active FROM users WHERE email = ?',
      [normalizedEmail],
    );
    const existingUser = existing[0] || null;
    const isReactivation =
      existingUser &&
      (String(existingUser.role || '').toLowerCase() !== 'admin' ||
        !existingUser.is_active);

    if (existingUser && !isReactivation) {
      return res.status(409).json({
        error: 'An active admin with this email already exists.',
      });
    }

    // Generate secure password (used for fresh insert; reactivation keeps the
    // existing hash because the password-reset email lets the user set a new one).
    const password = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    let profilePicture = null;
    if (req.file) {
      profilePicture = `/uploads/admins/${req.file.filename}`;
    }

    let adminPermissions = null;
    if (permissions) {
      try {
        adminPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
      } catch (e) {
        adminPermissions = permissions;
      }
    }

    const requestedRole = String(role || 'staff_admin').trim().toLowerCase();
    const resolvedRole = await resolveAdminRole(db.promise(), requestedRole);

    let userId;
    if (isReactivation) {
      // Re-promote the existing (demoted/customer) user. Don't touch their
      // password — they'll set one via the reset email. Profile picture only
      // overwrites when a new one was uploaded.
      await db.promise().query(
        `UPDATE users
            SET name = ?,
                phone = COALESCE(?, phone),
                role = 'admin',
                admin_role = ?,
                admin_permissions = ?,
                profile_image = COALESCE(?, profile_image),
                is_active = TRUE
          WHERE id = ?`,
        [
          full_name,
          phone || null,
          resolvedRole || 'staff_admin',
          JSON.stringify(adminPermissions),
          profilePicture,
          existingUser.id,
        ],
      );
      userId = existingUser.id;
      await logAdminAction(
        req.user.id,
        `Reactivated admin: ${normalizedEmail} (user ${existingUser.id})`,
        getClientIP(req),
      );
    } else {
      const [result] = await db.promise().query(
        `INSERT INTO users (name, email, password, phone, role, admin_role, admin_permissions, profile_image, is_active)
         VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, true)`,
        [
          full_name,
          normalizedEmail,
          hashedPassword,
          phone || null,
          resolvedRole || 'staff_admin',
          JSON.stringify(adminPermissions),
          profilePicture,
        ],
      );
      userId = result.insertId;
      await logAdminAction(req.user.id, `Created admin: ${normalizedEmail}`, getClientIP(req));
    }

    let emailStatus = 'sent';
    let emailError = null;

    try {
      const tokenData = await createPasswordResetToken(db.promise(), userId, normalizedEmail);

      if (!tokenData?.token) {
        throw new Error('Failed to generate reset token');
      }

      const emailResult = await sendPasswordResetEmail(
        normalizedEmail,
        full_name,
        tokenData.token,
        true,
      );

      if (!emailResult?.success) {
        throw new Error(emailResult?.error || 'Failed to send reset email');
      }
    } catch (error) {
      emailStatus = 'failed';
      emailError = error.message;
    }

    const actionVerb = isReactivation ? 'reactivated' : 'created';
    res.status(201).json({
      message:
        emailStatus === 'sent'
          ? `Admin ${actionVerb} successfully. Password reset email sent.`
          : `Admin ${actionVerb}, but the password reset email failed to send.`,
      emailStatus,
      emailError,
      reactivated: isReactivation,
      admin: { id: userId, email: normalizedEmail, full_name },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// PATCH /api/admin-management/admins/:id/status - Update admin status
router.patch('/admins/:id/status', authenticateToken, isAdmin, requireSuperAdmin, restrictBody('status'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Prevent self-deactivation
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    const isActive = status === 'active';
    await db.promise().query('UPDATE users SET is_active = ? WHERE id = ? AND role = "admin"', [isActive, id]);

    await logAdminAction(req.user.id, `Changed admin ${id} status to ${status}`, getClientIP(req));

    res.json({ message: 'Admin status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// POST /api/admin-management/admins/:id/profile-image - Upload/update admin profile image
router.post('/admins/:id/profile-image', authenticateToken, isAdmin, uploadProfileImage, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const isSelf = targetId === req.user.id;
    const isSuperAdmin = String(req.user.admin_role || '').toLowerCase() === 'super_admin';

    if (!isSelf && !isSuperAdmin) {
      return res.status(403).json({ error: 'You can only update your own profile image' });
    }

    if (!req.file || !req.file.url) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const imageUrl = req.file.url;
    const [result] = await db.promise().query(
      'UPDATE users SET profile_image = ? WHERE id = ? AND role = "admin"',
      [imageUrl, targetId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    await logAdminAction(req.user.id, `Updated admin ${targetId} profile image`, getClientIP(req));

    return res.json({ message: 'Profile image updated successfully', imageUrl });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update profile image' });
  }
});

// DELETE /api/admin-management/admins/:id/profile-image - Remove admin profile image
router.delete('/admins/:id/profile-image', authenticateToken, isAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const isSelf = targetId === req.user.id;
    const isSuperAdmin = String(req.user.admin_role || '').toLowerCase() === 'super_admin';

    if (!isSelf && !isSuperAdmin) {
      return res.status(403).json({ error: 'You can only update your own profile image' });
    }

    const [result] = await db.promise().query(
      'UPDATE users SET profile_image = NULL WHERE id = ? AND role = "admin"',
      [targetId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    await logAdminAction(req.user.id, `Removed admin ${targetId} profile image`, getClientIP(req));

    return res.json({ message: 'Profile image removed successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove profile image' });
  }
});

// PATCH /api/admin-management/admins/:id/role - Update admin role and permissions
router.patch('/admins/:id/role', authenticateToken, isAdmin, requireSuperAdmin, restrictBody('role', 'permissions'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;
    const normalizedRole = String(role || '').trim().toLowerCase();
    const allowedInputRoles = new Set(['super_admin', 'staff_admin', 'admin', 'moderator']);

    if (!allowedInputRoles.has(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const resolvedRole = await resolveAdminRole(db.promise(), normalizedRole);

    await db.promise().query(
      'UPDATE users SET admin_role = ?, admin_permissions = ? WHERE id = ? AND role = "admin"',
      [resolvedRole, JSON.stringify(permissions || null), id]
    );

    await logAdminAction(req.user.id, `Updated admin ${id} role to ${resolvedRole}`, getClientIP(req));

    res.json({ message: 'Admin role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin role' });
  }
});

// DELETE /api/admin-management/admins/:id/role - Remove admin role
router.delete('/admins/:id/role', authenticateToken, isAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }

    // Change role to customer instead of deleting
    await db.promise().query(
      'UPDATE users SET role = "customer", admin_role = NULL, admin_permissions = NULL WHERE id = ?',
      [id]
    );

    // Invalidate any outstanding password-reset tokens for this user so that
    // old welcome/reset emails don't keep returning a confusing "Invalid reset
    // link" error after the account has been demoted. Soft-mark them used.
    await db.promise().query(
      'UPDATE password_reset_tokens SET is_used = TRUE, used_at = NOW() WHERE user_id = ? AND is_used = FALSE',
      [id]
    );

    await logAdminAction(req.user.id, `Removed admin role from user ${id}`, getClientIP(req));

    res.json({ message: 'Admin role removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove admin role' });
  }
});

// GET /api/admin-management/admins/:id/logs - Get admin activity logs
router.get('/admins/:id/logs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const [logs] = await db.promise().query(
      'SELECT action, ip_address, created_at FROM admin_audit_logs WHERE admin_id = ? ORDER BY created_at DESC LIMIT ?',
      [id, limit]
    );

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// PATCH /api/admin-management/admins/:id/change-password - Change own password
router.patch('/admins/:id/change-password', authenticateToken, isAdmin, restrictBody('current_password', 'new_password', 'confirm_password'), async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password, confirm_password } = req.body;

    // Only allow changing own password
    if (parseInt(id) !== req.user.id) {
      return res.status(403).json({ error: 'You can only change your own password' });
    }

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    // Validate new password strength
    if (new_password.length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters long' });
    }

    const hasUpperCase = /[A-Z]/.test(new_password);
    const hasLowerCase = /[a-z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(new_password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({
        error: 'Password must include at least one uppercase, one lowercase, one number, and one special character'
      });
    }

    // Get current password hash
    const [user] = await db.promise().query(
      'SELECT password, email FROM users WHERE id = ?',
      [id]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(current_password, user[0].password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const isSamePassword = await bcrypt.compare(new_password, user[0].password);
    if (isSamePassword) {
      return res
        .status(400)
        .json({ error: 'New password must be different from your current password' });
    }

    const reusedPassword = await hasReusedPassword(db.promise(), id, new_password);
    if (reusedPassword) {
      return res.status(400).json({
        error: 'Password was recently used. Please choose a different password.',
      });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    await addPasswordToHistory(db.promise(), id, new_password);

    try {
      await syncDefaultAdminPassword(user[0]?.email, new_password);
    } catch (envError) {
    }

    const currentSession = req.token
      ? await touchSessionByToken(db.promise(), req.token)
      : null;
    const exceptSessionId = currentSession?.id || null;

    await revokeSessionsByUserId(db.promise(), id, exceptSessionId);
    await revokeRefreshTokensByUserId(db.promise(), id, 'password_change');

    await logAdminAction(req.user.id, `Changed own password`, getClientIP(req));

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/admin-management/admins/:id/reset-password - Reset admin password (Super Admin only)
router.post('/admins/:id/reset-password', authenticateToken, isAdmin, requireSuperAdmin, restrictBody(), async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot reset own password this way
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot reset your own password. Use change password instead.' });
    }

    // Get admin details
    const [admin] = await db.promise().query(
      'SELECT name, email FROM users WHERE id = ? AND role = "admin"',
      [id]
    );

    if (admin.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Generate new password
    const newPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await db.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    await addPasswordToHistory(db.promise(), id, newPassword);

    await revokeSessionsByUserId(db.promise(), id);
    await revokeRefreshTokensByUserId(db.promise(), id, 'password_reset');

    // Send email with new password
    const transporter = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Naturanza Food Admin" <${process.env.SMTP_USER || 'noreply@naturanza.com'}>`,
      to: admin[0].email,
      subject: 'Your Naturanza Admin Password Has Been Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Password Reset</h2>
          <p>Hello ${admin[0].name},</p>
          <p>Your password was reset by an administrator. Here is your new temporary password:</p>
          <div style="background-color: #f0f8f2; padding: 15px; border-left: 4px solid #16a34a; margin: 20px 0;">
            <p><strong>New Password:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">${newPassword}</code></p>
          </div>
          <p><strong>Please login and change it immediately for security purposes.</strong></p>
          <p><a href="${process.env.ADMIN_URL || 'http://localhost:5173/admin/login'}" style="color: #16a34a;">Login to Admin Panel</a></p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
    }

    await logAdminAction(req.user.id, `Reset password for admin ${admin[0].name} (${admin[0].email})`, getClientIP(req));

    res.json({ message: `Password reset and emailed to ${admin[0].email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
