const bcrypt = require("bcryptjs");
const { db } = require("../config/db");
const { verifyTwoFactorCode } = require("../utils/totp");
const { checkAccountLockout, recordFailedLoginAtomic } = require("../utils/loginSecurity");

/**
 * Step-up re-authentication middleware for high-privilege admin mutations
 * (IP allowlist edits, admin creation/elevation/removal, forced resets).
 *
 * Accepts credentials via dedicated headers (`X-Step-Up-Password`,
 * `X-Step-Up-Otp`) or body fields (`currentPassword`, `otpCode`). Headers are
 * preferred so `DELETE` routes and strict `restrictBody()` allowlists stay
 * untouched.
 */
const requireStepUp = ({ requireTwoFactorIfEnabled = true } = {}) => {
  return async (req, res, next) => {
    try {
      const userId = Number(req.user?.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const lockout = await checkAccountLockout(db.promise(), userId);
      if (lockout?.locked) {
        return res.status(429).json({
          error: "Too many failed verification attempts. Please try again later.",
          code: "ACCOUNT_LOCKED",
        });
      }

      const [rows] = await db
        .promise()
        .query(
          "SELECT id, email, password, two_fa_enabled, two_fa_secret_encrypted FROM users WHERE id = ? LIMIT 1",
          [userId],
        );

      const record = rows[0];
      if (!record) {
        return res.status(404).json({ error: "Admin account not found." });
      }

      const twoFaEnabled =
        record.two_fa_enabled === true || Number(record.two_fa_enabled) === 1;

      const headerPassword = req.headers["x-step-up-password"];
      const bodyPassword = req.body?.currentPassword;
      const currentPassword = String(
        headerPassword !== undefined ? headerPassword : bodyPassword || "",
      );

      if (!currentPassword) {
        return res.status(401).json({
          error: "Confirm your current password to continue.",
          code: "STEP_UP_REQUIRED",
          requiresTwoFactor: requireTwoFactorIfEnabled && twoFaEnabled,
        });
      }

      const passwordOk = await bcrypt.compare(currentPassword, record.password || "");
      if (!passwordOk) {
        await recordFailedLoginAtomic(db.promise(), userId, record.email, true);
        return res.status(401).json({
          error: "Current password is incorrect.",
          code: "STEP_UP_INVALID",
          requiresTwoFactor: requireTwoFactorIfEnabled && twoFaEnabled,
        });
      }

      if (requireTwoFactorIfEnabled && twoFaEnabled) {
        const headerOtp = req.headers["x-step-up-otp"];
        const bodyOtp = req.body?.otpCode;
        const otpCode = String(
          headerOtp !== undefined ? headerOtp : bodyOtp || "",
        ).trim();

        if (!otpCode) {
          return res.status(401).json({
            error: "Enter your 6-digit authenticator code to continue.",
            code: "STEP_UP_OTP_REQUIRED",
            requiresTwoFactor: true,
          });
        }

        const otpOk = verifyTwoFactorCode({
          encryptedSecret: record.two_fa_secret_encrypted,
          code: otpCode,
          userId,
        });

        if (!otpOk) {
          await recordFailedLoginAtomic(db.promise(), userId, record.email, true);
          return res.status(401).json({
            error: "Invalid two-factor authentication code.",
            code: "STEP_UP_OTP_INVALID",
            requiresTwoFactor: true,
          });
        }
      }

      return next();
    } catch (error) {
      return res.status(500).json({ error: "Step-up verification failed." });
    }
  };
};

module.exports = { requireStepUp };
