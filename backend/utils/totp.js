const crypto = require("crypto");
const { authenticator } = require("otplib");

authenticator.options = {
  window: 1,
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const getEncryptionKey = () => {
  const explicit = String(process.env.TWO_FA_ENCRYPTION_KEY || "").trim();
  if (explicit) {
    return crypto.createHash("sha256").update(explicit).digest();
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (jwtSecret) {
    return crypto.createHash("sha256").update(`admin-2fa:${jwtSecret}`).digest();
  }

  return null;
};

const encryptSecret = (plainText) => {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("TWO_FA_ENCRYPTION_KEY or JWT_SECRET must be configured");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

const decryptSecret = (encryptedValue) => {
  const key = getEncryptionKey();
  if (!key || !encryptedValue) {
    return null;
  }

  try {
    const packed = Buffer.from(String(encryptedValue), "base64");
    if (packed.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};

const generateTwoFactorSetup = ({ email }) => {
  const secret = authenticator.generateSecret();
  const issuer = String(process.env.TWO_FA_ISSUER || "Naturanza Food Admin").trim() || "Naturanza Food Admin";
  const accountName = String(email || "admin").trim() || "admin";

  return {
    secret,
    encryptedSecret: encryptSecret(secret),
    otpauthUrl: authenticator.keyuri(accountName, issuer, secret),
  };
};

const verifyTwoFactorCode = ({ encryptedSecret, code }) => {
  const normalizedCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const secret = decryptSecret(encryptedSecret);
  if (!secret) {
    return false;
  }

  try {
    return authenticator.verify({ token: normalizedCode, secret });
  } catch {
    return false;
  }
};

const hashRecoveryCode = (code) =>
  crypto.createHash("sha256").update(String(code || "").trim().toUpperCase()).digest("hex");

const generateRecoveryCodes = () => {
  const codes = Array.from({ length: 8 }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

  return {
    codes,
    hashes: codes.map(hashRecoveryCode),
  };
};

const consumeRecoveryCode = async ({ db: database, userId, code }) => {
  const normalizedHash = hashRecoveryCode(code);
  const supportsTransactions = typeof database.beginTransaction === "function";

  if (supportsTransactions) {
    await database.beginTransaction();
  }

  try {
    const [rows] = await database.query(
      `SELECT two_fa_recovery_codes
       FROM users
       WHERE id = ? AND two_fa_enabled = TRUE
       LIMIT 1${supportsTransactions ? " FOR UPDATE" : ""}`,
      [userId],
    );
    const codes = Array.isArray(rows[0]?.two_fa_recovery_codes)
      ? rows[0].two_fa_recovery_codes
      : typeof rows[0]?.two_fa_recovery_codes === "string"
        ? JSON.parse(rows[0].two_fa_recovery_codes || "[]")
        : [];

    if (!codes.includes(normalizedHash)) {
      if (supportsTransactions) {
        await database.rollback();
      }
      return false;
    }

    const remaining = codes.filter((value) => value !== normalizedHash);
    await database.query(
      "UPDATE users SET two_fa_recovery_codes = ? WHERE id = ? AND two_fa_enabled = TRUE",
      [JSON.stringify(remaining), userId],
    );

    if (supportsTransactions) {
      await database.commit();
    }
    return true;
  } catch (error) {
    if (supportsTransactions) {
      await database.rollback();
    }
    throw error;
  }
};

module.exports = {
  generateTwoFactorSetup,
  verifyTwoFactorCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
  decryptSecret,
};
