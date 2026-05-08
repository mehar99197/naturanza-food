const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const upload = require('../middleware/uploadConfig');
const { generateSecurePassword, logAdminAction, getClientIP, sendWelcomeEmail } = require('../utils/adminHelpers');
const { revokeSessionsByUserId, touchSessionByToken } = require('../utils/sessionManager');
const { revokeRefreshTokensByUserId } = require('../utils/tokenStore');
const { syncDefaultAdminPassword } = require('../utils/envSync');

// GET /api/admin-management/admins - Get all admins with filters
router.get('/admins', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, role, search } = req.query;
    
    let query = `
            SELECT id, name, email, phone, role, admin_role, admin_permissions,
              is_active, last_login, profile_image, created_at
      FROM users
      WHERE role = 'admin'
    `;
    const params = [];

    if (status === 'active') {
      query += ' AND is_active = true';
    } else if (status === 'inactive') {
      query += ' AND is_active = false';
    }

    if (role === 'super_admin' || role === 'staff_admin') {
      query += ' AND admin_role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const [admins] = await db.promise().query(query, params);
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// POST /api/admin-management/admins - Create new admin
router.post('/admins', authenticateToken, isAdmin, requireSuperAdmin, upload.single('profile_picture'), async (req, res) => {
  try {
    const { full_name, email, phone, role, permissions } = req.body;
    
    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }

    // Check if email already exists
    const [existing] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Generate secure password
    const password = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Handle profile picture
    let profilePicture = null;
    if (req.file) {
      profilePicture = `/uploads/admins/${req.file.filename}`;
    }

    // Parse permissions
    let adminPermissions = null;
    if (permissions) {
      try {
        adminPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
      } catch (e) {
        adminPermissions = permissions;
      }
    }

    // Insert new admin
    const [result] = await db.promise().query(
      `INSERT INTO users (name, email, password, phone, role, admin_role, admin_permissions, profile_image, is_active)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, true)`,
      [full_name, email, hashedPassword, phone || null, role || 'staff_admin', JSON.stringify(adminPermissions), profilePicture]
    );

    // Log action
    await logAdminAction(req.user.id, `Created admin: ${email}`, getClientIP(req));

    // Send welcome email with credentials
    await sendWelcomeEmail(email, full_name, password);
    
    res.status(201).json({
      message: 'Admin created successfully. Welcome email sent with login credentials.',
      admin: { id: result.insertId, email, full_name }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// PATCH /api/admin-management/admins/:id/status - Update admin status
router.patch('/admins/:id/status', authenticateToken, isAdmin, requireSuperAdmin, async (req, res) => {
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
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// PATCH /api/admin-management/admins/:id/role - Update admin role and permissions
router.patch('/admins/:id/role', authenticateToken, isAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;

    if (!role || !['super_admin', 'staff_admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.promise().query(
      'UPDATE users SET admin_role = ?, admin_permissions = ? WHERE id = ? AND role = "admin"',
      [role, JSON.stringify(permissions || null), id]
    );

    await logAdminAction(req.user.id, `Updated admin ${id} role to ${role}`, getClientIP(req));

    res.json({ message: 'Admin role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
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

    await logAdminAction(req.user.id, `Removed admin role from user ${id}`, getClientIP(req));

    res.json({ message: 'Admin role removed successfully' });
  } catch (error) {
    console.error('Remove role error:', error);
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
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// PATCH /api/admin-management/admins/:id/change-password - Change own password
router.patch('/admins/:id/change-password', authenticateToken, isAdmin, async (req, res) => {
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
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const hasUpperCase = /[A-Z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(new_password);

    if (!hasUpperCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one number, and one special character' 
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

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    try {
      await syncDefaultAdminPassword(user[0]?.email, new_password);
    } catch (envError) {
      console.warn('Failed to sync DEFAULT_ADMIN_PASSWORD:', envError.message);
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
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/admin-management/admins/:id/reset-password - Reset admin password (Super Admin only)
router.post('/admins/:id/reset-password', authenticateToken, isAdmin, requireSuperAdmin, async (req, res) => {
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
      from: `"Naturanza Foods Admin" <${process.env.SMTP_USER || 'noreply@naturanza.com'}>`,
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
      console.error('Failed to send password reset email:', emailError);
    }

    await logAdminAction(req.user.id, `Reset password for admin ${admin[0].name} (${admin[0].email})`, getClientIP(req));

    res.json({ message: `Password reset and emailed to ${admin[0].email}` });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
