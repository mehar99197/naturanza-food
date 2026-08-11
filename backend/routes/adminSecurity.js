const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { db } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const { enforceSuperAdminIpAllowlist } = require("../middleware/adminIpAllowlist");
const { getClientIp } = require("../utils/clientIp");
const { getTrustedClientIp } = require("../utils/rateLimitKey");
const { hashToken } = require("../utils/sessionManager");
const { revokeRefreshTokensBySessionId } = require("../utils/tokenStore");
const {
  generateTwoFactorSetup,
  verifyTwoFactorCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
} = require("../utils/totp");
const { parseCidr, ipMatchesCidr } = require("../utils/ipAllowlist");
const {
  listAllowlistEntries,
  recordAdminAuditLog,
  getSecurityOverview,
  resolveDeviceName,
  toBoolean,
} = require("../utils/adminSecurity");

const audit = (req, action, category, metadata = null) =>
  recordAdminAuditLog({
    adminId: req.user.id,
    action,
    category,
    actorEmail: req.user.email,
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"] || null,
    metadata,
  });

const requireAdminAccount = (req, res, next) => {
  if (String(req.user?.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Admin account required" });
  }
  return next();
};

// Defence in depth: isAdmin also recognizes legacy admin_role-only rows for
// compatibility, but Security Center must only be reachable by role='admin'.
router.use(authenticateToken, isAdmin, requireAdminAccount, enforceSuperAdminIpAllowlist);

const getCurrentSessionId = async (req) => {
  const tokenHash = hashToken(req.token || "");
  if (!tokenHash) return null;
  const [rows] = await db
    .promise()
    .query("SELECT id FROM user_sessions WHERE token_hash = ? LIMIT 1", [tokenHash]);
  return rows[0]?.id || null;
};

const mapSessionRow = (row, currentSessionId) => ({
  id: row.id,
  device: resolveDeviceName(row.user_agent),
  provider: row.login_provider || "password",
  ipAddress: row.ip_address || "Unknown",
  loginTime: row.created_at,
  lastActive: row.last_seen_at || row.created_at,
  isCurrent: Number(row.id) === Number(currentSessionId),
});

// GET /api/admin/security/overview — status cards + activity feeds for the
// signed-in admin. Never returns secrets (only counts/flags).
router.get(
  "/overview",
  authenticateToken,
  isAdmin,
  asyncHandler(async (req, res) => {
    const overview = await getSecurityOverview({ userId: req.user.id });
    if (!overview) {
      return res.status(404).json({ error: "Admin account not found" });
    }

    const currentSessionId = await getCurrentSessionId(req);
    res.json({
      ...overview,
      sessions: overview.sessions.map((row) => mapSessionRow(row, currentSessionId)),
      currentIp: getTrustedClientIp(req) || getClientIp(req) || null,
    });
  }),
);

// GET /api/admin/security/sessions
router.get(
  "/sessions",
  authenticateToken,
  isAdmin,
  asyncHandler(async (req, res) => {
    const currentSessionId = await getCurrentSessionId(req);
    const [rows] = await db.promise().query(
      `SELECT id, login_provider, ip_address, user_agent, last_seen_at, created_at
       FROM user_sessions
       WHERE user_id = ? AND is_active = TRUE
       ORDER BY COALESCE(last_seen_at, created_at) DESC
       LIMIT 20`,
      [req.user.id],
    );
    res.json({ items: rows.map((row) => mapSessionRow(row, currentSessionId)) });
  }),
);

// POST /api/admin/security/sessions/:sessionId/revoke
router.post(
  "/sessions/:sessionId/revoke",
  authenticateToken,
  isAdmin,
  restrictBody(),
  asyncHandler(async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: "Invalid session id." });
    }

    const currentSessionId = await getCurrentSessionId(req);
    if (currentSessionId && Number(currentSessionId) === sessionId) {
      return res.status(400).json({
        error: "You cannot revoke your current session here. Use logout instead.",
      });
    }

    const [result] = await db.promise().query(
      `UPDATE user_sessions
       SET is_active = FALSE, revoked_at = NOW(), last_seen_at = NOW()
       WHERE id = ? AND user_id = ? AND is_active = TRUE`,
      [sessionId, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    await revokeRefreshTokensBySessionId(db.promise(), sessionId, "admin_revoke_session");
    await audit(req, `Revoked admin session #${sessionId}`, "session");

    res.json({ message: "Session revoked successfully." });
  }),
);

// POST /api/admin/security/sessions/revoke-others
router.post(
  "/sessions/revoke-others",
  authenticateToken,
  isAdmin,
  restrictBody(),
  asyncHandler(async (req, res) => {
    const currentSessionId = await getCurrentSessionId(req);

    const params = [req.user.id];
    let selectSql = `SELECT id FROM user_sessions WHERE user_id = ? AND is_active = TRUE`;
    if (currentSessionId) {
      selectSql += " AND id <> ?";
      params.push(currentSessionId);
    }
    const [sessionRows] = await db.promise().query(selectSql, params);

    const updateParams = [req.user.id];
    let updateSql = `UPDATE user_sessions
       SET is_active = FALSE, revoked_at = NOW(), last_seen_at = NOW()
       WHERE user_id = ? AND is_active = TRUE`;
    if (currentSessionId) {
      updateSql += " AND id <> ?";
      updateParams.push(currentSessionId);
    }
    const [result] = await db.promise().query(updateSql, updateParams);

    for (const row of sessionRows) {
      await revokeRefreshTokensBySessionId(db.promise(), row.id, "admin_revoke_others");
    }

    await audit(req, "Revoked all other admin sessions", "session", {
      revoked: result.affectedRows || 0,
    });

    res.json({
      message: "All other sessions revoked.",
      revokedSessions: result.affectedRows || 0,
    });
  }),
);

// ============================================
// TWO-FACTOR AUTHENTICATION (TOTP)
// ============================================

// POST /api/admin/security/2fa/setup — generates a pending secret. The secret
// is stored encrypted but 2FA stays OFF until /2fa/enable verifies a code.
router.post(
  "/2fa/setup",
  authenticateToken,
  isAdmin,
  restrictBody(),
  asyncHandler(async (req, res) => {
    const [rows] = await db
      .promise()
      .query("SELECT two_fa_enabled FROM users WHERE id = ? LIMIT 1", [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: "Admin account not found" });
    }
    if (toBoolean(rows[0].two_fa_enabled)) {
      return res.status(400).json({
        error: "Two-factor authentication is already enabled. Disable it first to set up again.",
      });
    }

    const setup = generateTwoFactorSetup({ email: req.user.email });
    await db
      .promise()
      .query(
        "UPDATE users SET two_fa_secret_encrypted = ?, two_fa_enabled = FALSE, two_fa_enabled_at = NULL, two_fa_recovery_codes = NULL WHERE id = ?",
        [setup.encryptedSecret, req.user.id],
      );

    await audit(req, "Started two-factor authentication setup", "2fa");

    res.json({
      otpauthUrl: setup.otpauthUrl,
      manualSecret: setup.secret,
    });
  }),
);

// POST /api/admin/security/2fa/enable — verifies a code from the pending
// secret, then enables 2FA and returns one-time recovery codes.
router.post(
  "/2fa/enable",
  authenticateToken,
  isAdmin,
  restrictBody("code"),
  asyncHandler(async (req, res) => {
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit code from your authenticator app." });
    }

    const [rows] = await db
      .promise()
      .query(
        "SELECT two_fa_enabled, two_fa_secret_encrypted FROM users WHERE id = ? LIMIT 1",
        [req.user.id],
      );

    const record = rows[0];
    if (!record) {
      return res.status(404).json({ error: "Admin account not found" });
    }
    if (toBoolean(record.two_fa_enabled)) {
      return res.status(400).json({ error: "Two-factor authentication is already enabled." });
    }
    if (!record.two_fa_secret_encrypted) {
      return res.status(400).json({ error: "Start two-factor setup first." });
    }

    const valid = verifyTwoFactorCode({
      encryptedSecret: record.two_fa_secret_encrypted,
      code,
    });
    if (!valid) {
      return res.status(400).json({ error: "Invalid code. Check your authenticator app and try again." });
    }

    const recovery = generateRecoveryCodes();
    await db
      .promise()
      .query(
        "UPDATE users SET two_fa_enabled = TRUE, two_fa_enabled_at = NOW(), two_fa_recovery_codes = ? WHERE id = ?",
        [JSON.stringify(recovery.hashes), req.user.id],
      );

    await audit(req, "Enabled two-factor authentication", "2fa");

    res.json({
      message: "Two-factor authentication enabled.",
      recoveryCodes: recovery.codes,
    });
  }),
);

// POST /api/admin/security/2fa/disable — requires the account password AND a
// valid TOTP or recovery code. Also revokes every other active session.
router.post(
  "/2fa/disable",
  authenticateToken,
  isAdmin,
  restrictBody("password", "code"),
  asyncHandler(async (req, res) => {
    const password = String(req.body?.password || "");
    const code = String(req.body?.code || "").trim();

    if (!password || !code) {
      return res.status(400).json({ error: "Password and authentication code are required." });
    }

    const [rows] = await db
      .promise()
      .query(
        "SELECT password, two_fa_enabled, two_fa_secret_encrypted FROM users WHERE id = ? LIMIT 1",
        [req.user.id],
      );

    const record = rows[0];
    if (!record) {
      return res.status(404).json({ error: "Admin account not found" });
    }
    if (!toBoolean(record.two_fa_enabled)) {
      return res.status(400).json({ error: "Two-factor authentication is not enabled." });
    }

    const passwordOk = await bcrypt.compare(password, record.password || "");
    if (!passwordOk) {
      return res.status(401).json({ error: "Password is incorrect." });
    }

    let codeOk = verifyTwoFactorCode({
      encryptedSecret: record.two_fa_secret_encrypted,
      code,
    });
    if (!codeOk) {
      codeOk = await consumeRecoveryCode({ db: db.promise(), userId: req.user.id, code });
    }
    if (!codeOk) {
      return res.status(401).json({ error: "Invalid authentication or recovery code." });
    }

    await db
      .promise()
      .query(
        "UPDATE users SET two_fa_enabled = FALSE, two_fa_enabled_at = NULL, two_fa_secret_encrypted = NULL, two_fa_recovery_codes = NULL WHERE id = ?",
        [req.user.id],
      );

    // Disabling 2FA weakens the account — kill every other session so a
    // hijacked session cannot linger after the owner reduces protection.
    const currentSessionId = await getCurrentSessionId(req);
    const selectParams = [req.user.id];
    let revokeSql = "SELECT id FROM user_sessions WHERE user_id = ? AND is_active = TRUE";
    if (currentSessionId) {
      revokeSql += " AND id <> ?";
      selectParams.push(currentSessionId);
    }
    const [otherSessions] = await db.promise().query(revokeSql, selectParams);

    const updateParams = [req.user.id];
    let updateSql = "UPDATE user_sessions SET is_active = FALSE, revoked_at = NOW(), last_seen_at = NOW() WHERE user_id = ? AND is_active = TRUE";
    if (currentSessionId) {
      updateSql += " AND id <> ?";
      updateParams.push(currentSessionId);
    }
    await db.promise().query(updateSql, updateParams);
    for (const row of otherSessions) {
      await revokeRefreshTokensBySessionId(db.promise(), row.id, "admin_2fa_disabled");
    }

    await audit(req, "Disabled two-factor authentication", "2fa");

    res.json({ message: "Two-factor authentication disabled." });
  }),
);

// POST /api/admin/security/2fa/recovery-codes — regenerate recovery codes.
// Requires a current valid TOTP code so a hijacked session cannot silently
// rotate the owner's recovery codes.
router.post(
  "/2fa/recovery-codes",
  authenticateToken,
  isAdmin,
  restrictBody("code"),
  asyncHandler(async (req, res) => {
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit code from your authenticator app." });
    }

    const [rows] = await db
      .promise()
      .query(
        "SELECT two_fa_enabled, two_fa_secret_encrypted FROM users WHERE id = ? LIMIT 1",
        [req.user.id],
      );

    const record = rows[0];
    if (!record || !toBoolean(record.two_fa_enabled)) {
      return res.status(400).json({ error: "Two-factor authentication is not enabled." });
    }

    const valid = verifyTwoFactorCode({
      encryptedSecret: record.two_fa_secret_encrypted,
      code,
    });
    if (!valid) {
      return res.status(401).json({ error: "Invalid authentication code." });
    }

    const recovery = generateRecoveryCodes();
    await db
      .promise()
      .query("UPDATE users SET two_fa_recovery_codes = ? WHERE id = ?", [
        JSON.stringify(recovery.hashes),
        req.user.id,
      ]);

    await audit(req, "Regenerated two-factor recovery codes", "2fa");

    res.json({
      message: "Recovery codes regenerated.",
      recoveryCodes: recovery.codes,
    });
  }),
);

// ============================================
// SUPER-ADMIN IP ALLOWLIST (super_admin only)
// ============================================

// GET /api/admin/security/ip-allowlist
router.get(
  "/ip-allowlist",
  authenticateToken,
  isAdmin,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const entries = await listAllowlistEntries();
    res.json({
      items: entries,
      currentIp: getTrustedClientIp(req) || getClientIp(req) || null,
      enforced: entries.length > 0,
    });
  }),
);

// POST /api/admin/security/ip-allowlist — body: { label, cidr }
// SAFETY: the very first entry must cover the requester's current IP so a
// super admin can never lock themselves out by enabling the allowlist on a
// network they are not currently on.
router.post(
  "/ip-allowlist",
  authenticateToken,
  isAdmin,
  requireSuperAdmin,
  restrictBody("label", "cidr"),
  asyncHandler(async (req, res) => {
    const label = String(req.body?.label || "").trim().slice(0, 120);
    const parsed = parseCidr(req.body?.cidr);

    if (!label) {
      return res.status(400).json({ error: "Label is required." });
    }
    if (!parsed) {
      return res.status(400).json({
        error: "Invalid IPv4 or CIDR value. Examples: 203.0.113.10 or 203.0.113.0/24",
      });
    }

    const existing = await listAllowlistEntries();
    const currentIp = getTrustedClientIp(req) || getClientIp(req);
    if (existing.length === 0 && !ipMatchesCidr(currentIp, parsed.cidr)) {
      return res.status(400).json({
        error: `The first allowlist entry must include your current IP (${currentIp || "unknown"}). This prevents accidental lockout.`,
      });
    }

    if (existing.some((entry) => String(entry.cidr).toLowerCase() === parsed.cidr.toLowerCase())) {
      return res.status(409).json({ error: "This IP/CIDR is already in the allowlist." });
    }

    const [result] = await db
      .promise()
      .query(
        "INSERT INTO admin_security_ip_allowlist (label, cidr, created_by) VALUES (?, ?, ?)",
        [label, parsed.cidr, req.user.id],
      );

    await audit(req, `Added super-admin IP allowlist entry ${parsed.cidr} (${label})`, "ip_allowlist");

    res.status(201).json({
      message: "IP allowlist entry added.",
      item: {
        id: result.insertId,
        label,
        cidr: parsed.cidr,
        created_by: req.user.id,
      },
    });
  }),
);

// DELETE /api/admin/security/ip-allowlist/:id
router.delete(
  "/ip-allowlist/:id",
  authenticateToken,
  isAdmin,
  requireSuperAdmin,
  restrictBody(),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid entry id." });
    }

    const [rows] = await db
      .promise()
      .query("SELECT id, cidr, label FROM admin_security_ip_allowlist WHERE id = ? LIMIT 1", [id]);

    if (!rows.length) {
      return res.status(404).json({ error: "Allowlist entry not found." });
    }

    await db
      .promise()
      .query("DELETE FROM admin_security_ip_allowlist WHERE id = ?", [id]);

    await audit(
      req,
      `Removed super-admin IP allowlist entry ${rows[0].cidr} (${rows[0].label})`,
      "ip_allowlist",
    );

    res.json({ message: "Allowlist entry removed." });
  }),
);

module.exports = router;
