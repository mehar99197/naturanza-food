const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { db } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { uploadProfileImage } = require("../middleware/upload");
const { restrictBody } = require("../middleware/security");
const {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  toExpiryDate,
  getRefreshCookieOptions,
  clearRefreshCookie,
  getJwtRuntimeInfo,
} = require("../utils/jwtTokens");
const {
  createUserSession,
  updateSessionToken,
  revokeSessionByToken,
  revokeSessionById,
  revokeSessionsByUserId,
} = require("../utils/sessionManager");
const {
  createRefreshTokenRecord,
  findActiveRefreshTokenRecord,
  rotateRefreshTokenRecord,
  revokeRefreshTokenByJti,
  revokeRefreshTokensBySessionId,
  revokeRefreshTokensByUserId,
  touchRefreshTokenByJti,
  blacklistAccessToken,
} = require("../utils/tokenStore");
const {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  strongPassword,
} = require("../validation/authSchemas");
const {
  sendPasswordResetEmail,
  sendVerificationCodeEmail,
} = require("../utils/emailService");
const { isDisposableEmail, hasDeliverableDomain } = require("../utils/emailValidation");
const { getClientIp } = require("../utils/clientIp");
const {
  createVerificationCode,
  verifyCode,
  secondsUntilResendAllowed,
} = require("../utils/emailVerificationCodes");
const {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  invalidateAllUserTokens,
} = require("../utils/passwordResetTokens");
const {
  ensurePasswordHistoryTable,
  addPasswordToHistory,
  hasReusedPassword,
} = require("../utils/passwordHistory");
const {
  recordFailedLoginAtomic,
  resetLoginFailuresAtomic,
  checkAccountLockout,
} = require("../utils/loginSecurity");

const googleClient = new OAuth2Client();
const IP_LOOKUP_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "2000",
  10,
);
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const ipLocationCache = new Map();
const LOGIN_MAX_ATTEMPTS =
  Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_LOCK_MINUTES =
  Number.parseInt(process.env.LOGIN_LOCK_MINUTES || "15", 10) || 15;
const JWT_RUNTIME = getJwtRuntimeInfo();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipLocationCache.entries()) {
    if (now - entry.timestamp > LOCATION_CACHE_TTL_MS) {
      ipLocationCache.delete(key);
    }
  }
}, LOCATION_CACHE_TTL_MS);

const getAllowedGoogleClientIds = () => {
  const configuredIds = [
    process.env.GOOGLE_CLIENT_ID,
    ...(process.env.GOOGLE_CLIENT_IDS || "").split(","),
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);

  return [...new Set(configuredIds)];
};

// Real client IP for display/logging (login history, sessions, geolocation).
// Behind Hostinger's proxy, Express's req.ip is an internal hop, so we resolve
// the originating client from the forwarded headers — see utils/clientIp.js.
const getRequestIp = (req) => getClientIp(req);

const isPrivateOrLocalIp = (ipAddress) => {
  const ip = String(ipAddress || "").trim().toLowerCase();
  if (!ip) {
    return true;
  }

  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "localhost") {
    return true;
  }

  if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return true;
  }

  if (ip.startsWith("169.254.")) {
    return true;
  }

  const private172 = ip.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) {
    return true;
  }

  return false;
};

const getCachedLocationForIp = (ipAddress) => {
  const cacheEntry = ipLocationCache.get(ipAddress);
  if (!cacheEntry) {
    return null;
  }

  if (Date.now() - cacheEntry.timestamp > LOCATION_CACHE_TTL_MS) {
    ipLocationCache.delete(ipAddress);
    return null;
  }

  return cacheEntry.location;
};

const setCachedLocationForIp = (ipAddress, location) => {
  ipLocationCache.set(ipAddress, {
    location,
    timestamp: Date.now(),
  });
};

const lookupLocationByIp = async (ipAddress) => {
  if (!ipAddress || isPrivateOrLocalIp(ipAddress)) {
    return "Local Network";
  }

  const cachedLocation = getCachedLocationForIp(ipAddress);
  if (cachedLocation) {
    return cachedLocation;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(
        `https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`,
        {
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return "Unknown";
    }

    const data = await response.json();
    const city = String(data?.city || "").trim();
    const region = String(data?.region || "").trim();
    const country = String(data?.country_name || data?.country || "").trim();

    const location = [city, region, country].filter(Boolean).join(", ") || "Unknown";
    setCachedLocationForIp(ipAddress, location);
    return location;
  } catch (error) {
    return "Unknown";
  }
};

const toBooleanFlag = (value, fallback = true) => {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  return Boolean(Number(value));
};

const resolveRequestLocation = async (req, ipAddress = null) => {
  const city = String(req.headers["x-city"] || req.headers["cf-ipcity"] || "").trim();
  const region = String(
    req.headers["x-region"] || req.headers["cf-region"] || "",
  ).trim();
  const country = String(
    req.headers["x-country"] ||
      req.headers["x-country-code"] ||
      req.headers["cf-ipcountry"] ||
      req.headers["x-vercel-ip-country"] ||
      "",
  ).trim();

  const parts = [city, region, country].filter(Boolean);
  if (parts.length) {
    return parts.join(", ");
  }

  return lookupLocationByIp(ipAddress || getRequestIp(req));
};

const resolveDeviceName = (userAgent = "") => {
  const ua = String(userAgent || "");
  const lowered = ua.toLowerCase();

  if (!ua) {
    return "Unknown Device";
  }

  const browser =
    lowered.includes("edg/")
      ? "Edge"
      : lowered.includes("chrome/")
        ? "Chrome"
        : lowered.includes("firefox/")
          ? "Firefox"
          : lowered.includes("safari/") && !lowered.includes("chrome/")
            ? "Safari"
            : lowered.includes("opr/") || lowered.includes("opera")
              ? "Opera"
              : "Browser";

  const device =
    lowered.includes("android")
      ? "Android"
      : lowered.includes("iphone")
        ? "iPhone"
        : lowered.includes("ipad")
          ? "iPad"
          : lowered.includes("windows")
            ? "Windows"
            : lowered.includes("mac os") || lowered.includes("macintosh")
              ? "macOS"
              : lowered.includes("linux")
                ? "Linux"
                : "Device";

  return `${browser} on ${device}`;
};

const recordLoginHistorySafely = async ({
  req,
  userId = null,
  attemptedEmail = null,
  status = "failed",
  provider = "password",
  failureReason = null,
}) => {
  try {
    const normalizedStatus = status === "success" ? "success" : "failed";
    const ipAddress = getRequestIp(req);
    const locationLabel = await resolveRequestLocation(req, ipAddress);

    await db.promise().query(
      `INSERT INTO user_login_history
        (user_id, attempted_email, login_provider, ip_address, user_agent, device_name, location_label, status, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        attemptedEmail ? String(attemptedEmail).trim().toLowerCase() : null,
        provider,
        ipAddress,
        req.headers["user-agent"] || null,
        resolveDeviceName(req.headers["user-agent"] || ""),
        locationLabel,
        normalizedStatus,
        normalizedStatus === "failed" ? failureReason || "Authentication failed" : null,
      ],
    );
  } catch (error) {
    // Keep authentication deterministic even if history logging fails.
  }
};

const createSessionSafely = async (
  req,
  userId,
  token,
  provider = "password",
) => {
  try {
    return await createUserSession(db.promise(), {
      userId,
      token,
      provider,
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (error) {
    return null;
  }
};

const parsePayload = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid request payload",
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
};

const isAccountLocked = (userRecord) => {
  const lockUntil = userRecord?.locked_until
    ? new Date(userRecord.locked_until)
    : null;

  if (!lockUntil || Number.isNaN(lockUntil.getTime())) {
    return false;
  }

  return lockUntil > new Date();
};

const markFailedLoginAttempt = async (userRecord) => {
  const currentAttempts = Number(userRecord?.failed_login_attempts || 0);
  const nextAttempt = currentAttempts + 1;
  const shouldLock = nextAttempt >= LOGIN_MAX_ATTEMPTS;

  await db
    .promise()
    .query(
      "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
      [
        shouldLock ? 0 : nextAttempt,
        shouldLock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) : null,
        userRecord.id,
      ],
    );
};

const resetLoginFailures = async (userId) => {
  await db
    .promise()
    .query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      [userId],
    );
};

const buildUserResponse = (userRecord, overrides = {}) => ({
  id: userRecord.id,
  name: userRecord.name,
  email: userRecord.email,
  phone: userRecord.phone || null,
  address: userRecord.address || null,
  profile_image: userRecord.profile_image || null,
  signup_provider: userRecord.signup_provider || "password",
  password_set_by_user: toBooleanFlag(userRecord.password_set_by_user, true),
  role: userRecord.role,
  ...overrides,
});

const issueAuthSession = async (req, res, userRecord, provider = "password") => {
  const access = issueAccessToken(userRecord);
  const refresh = issueRefreshToken(userRecord);
  const sessionId = await createSessionSafely(req, userRecord.id, access.token, provider);

  if (!sessionId) {
    throw new Error("Could not persist session");
  }

  const refreshPayload = verifyRefreshToken(refresh.token);
  const refreshExpiry = toExpiryDate(refreshPayload);

  await createRefreshTokenRecord(db.promise(), {
    userId: userRecord.id,
    sessionId,
    refreshToken: refresh.token,
    refreshTokenJti: refresh.jti,
    expiresAt: refreshExpiry,
    ipAddress: getRequestIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  res.cookie(
    JWT_RUNTIME.refreshCookieName,
    refresh.token,
    getRefreshCookieOptions(),
  );

  return {
    accessToken: access.token,
    accessTokenExpiresIn: access.expiresInSeconds,
  };
};

const getBearerToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

// Register new user
router.post("/register", async (req, res) => {
  try {
    const parsedBody = parsePayload(registerSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const { name, email, password, phone, address } = parsedBody.data;
    const normalizedEmail = String(email).trim().toLowerCase();

    // Reject obviously fake addresses up front. The 6-digit code emailed below is
    // the real proof of ownership; these checks just filter out the obvious fakes.
    if (await isDisposableEmail(normalizedEmail)) {
      return res.status(400).json({
        error: "Temporary/disposable emails are not allowed. Please use a permanent email address.",
      });
    }
    if (!(await hasDeliverableDomain(normalizedEmail))) {
      return res.status(400).json({
        error: "This email domain can't receive mail. Please check your email address.",
      });
    }

    const [existingUsers] = await db
      .promise()
      .query("SELECT id, email_verified FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);

    if (existingUsers.length > 0) {
      // A prior signup that was never verified: steer them to verification
      // instead of a dead-end "already registered" error.
      if (!existingUsers[0].email_verified) {
        return res.status(409).json({
          error: "This email is already registered but not verified. Please verify it.",
          code: "EMAIL_NOT_VERIFIED",
          email: normalizedEmail,
        });
      }
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const [insertResult] = await db.promise().query(
      `INSERT INTO users
        (name, email, password, phone, address, role, signup_provider, password_set_by_user, email_verified, failed_login_attempts, locked_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, 0, NULL)`,
      [
        name,
        normalizedEmail,
        hashedPassword,
        phone || null,
        address || null,
        "customer",
        "password",
        true,
      ],
    );

    // Email the verification code. The account stays inactive (cannot log in)
    // until the code is confirmed at POST /verify-email.
    const { code, expiresInMinutes } = await createVerificationCode(
      db.promise(),
      insertResult.insertId,
      normalizedEmail,
    );
    void sendVerificationCodeEmail(normalizedEmail, name, code, expiresInMinutes);

    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({
      message: "We've sent a 6-digit verification code to your email.",
      requiresVerification: true,
      email: normalizedEmail,
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Verify email with the 6-digit code, then sign the user in
router.post("/verify-email", async (req, res) => {
  try {
    const parsedBody = parsePayload(verifyEmailSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const normalizedEmail = String(parsedBody.data.email).trim().toLowerCase();
    const result = await verifyCode(db.promise(), normalizedEmail, parsedBody.data.code);

    if (!result.valid) {
      return res.status(400).json({ error: result.reason, code: "INVALID_CODE" });
    }

    await db
      .promise()
      .query("UPDATE users SET email_verified = TRUE WHERE id = ?", [result.userId]);

    const [users] = await db.promise().query(
      "SELECT id, name, email, phone, address, profile_image, role, is_active, signup_provider, password_set_by_user FROM users WHERE id = ? LIMIT 1",
      [result.userId],
    );
    const user = users[0];

    if (!user || !user.is_active) {
      return res.status(403).json({ error: "Account is not available. Please contact support." });
    }

    if (String(user.role || "").trim().toLowerCase() === "admin") {
      return res.status(403).json({
        error: "Admin accounts must use the admin login page.",
        isAdmin: true,
        redirect: "/admin/login",
      });
    }

    const authSession = await issueAuthSession(req, res, user, "password");

    void recordLoginHistorySafely({
      req,
      userId: user.id,
      attemptedEmail: user.email,
      status: "success",
      provider: "password",
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      message: "Email verified successfully",
      accessToken: authSession.accessToken,
      accessTokenExpiresIn: authSession.accessTokenExpiresIn,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Resend the email verification code (per-user cooldown prevents email-bombing)
router.post("/resend-verification", async (req, res) => {
  try {
    const parsedBody = parsePayload(resendVerificationSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const normalizedEmail = String(parsedBody.data.email).trim().toLowerCase();
    const [users] = await db.promise().query(
      "SELECT id, name, email_verified FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail],
    );

    // Generic response so this endpoint can't be used to probe which emails exist.
    const genericOk = () =>
      res.status(200).json({
        message: "If that account exists and is unverified, a new code has been sent.",
      });

    if (!users.length || users[0].email_verified) {
      return genericOk();
    }

    const user = users[0];
    const wait = await secondsUntilResendAllowed(db.promise(), user.id);
    if (wait > 0) {
      return res.status(429).json({
        error: `Please wait ${wait}s before requesting another code.`,
        retryAfterSeconds: wait,
      });
    }

    const { code, expiresInMinutes } = await createVerificationCode(
      db.promise(),
      user.id,
      normalizedEmail,
    );
    void sendVerificationCodeEmail(normalizedEmail, user.name, code, expiresInMinutes);

    return genericOk();
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const parsedBody = parsePayload(loginSchema, req.body || {});
    if (!parsedBody.ok) {
      void recordLoginHistorySafely({
        req,
        attemptedEmail: String(req.body?.email || "")
          .trim()
          .toLowerCase() || null,
        status: "failed",
        provider: "password",
        failureReason: "Invalid login payload",
      });

      connection.release();
      return res.status(400).json({ error: parsedBody.error });
    }

    const { email, password } = parsedBody.data;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const [users] = await connection.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (!users.length) {
      void recordLoginHistorySafely({
        req,
        attemptedEmail: normalizedEmail,
        status: "failed",
        provider: "password",
        failureReason: "Invalid credentials",
      });

      connection.release();
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    if (!user.is_active) {
      void recordLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        provider: "password",
        failureReason: "Account disabled",
      });

      connection.release();
      return res
        .status(403)
        .json({ error: "Account is disabled. Please contact support." });
    }

    const lockStatus = await checkAccountLockout(connection, user.id);
    if (lockStatus.locked) {
      connection.release();
      return res.status(423).json({
        error: "Account temporarily locked due to multiple failed attempts.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await recordFailedLoginAtomic(connection, user.id, user.email, false);
      const newLockStatus = await checkAccountLockout(connection, user.id);

      void recordLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        provider: "password",
        failureReason: "Invalid credentials",
      });

      connection.release();

      if (newLockStatus.locked) {
        return res.status(423).json({
          error: "Account temporarily locked due to multiple failed attempts.",
        });
      }

      // Uniform response (no attemptsLeft) so an attacker cannot distinguish a
      // real account from an unknown email via the response body.
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    await resetLoginFailuresAtomic(connection, user.id);
    connection.release();

    if (String(user.role || "").trim().toLowerCase() === "admin") {
      void recordLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        provider: "password",
        failureReason: "Admin account attempted customer login",
      });

      return res.status(403).json({
        error: "Admin accounts must use the admin login page.",
        isAdmin: true,
        redirect: "/admin/login",
      });
    }

    // Block sign-in until the email is verified. Existing accounts were
    // grandfathered as verified by the migration, so only new, unverified
    // self-signups are gated here.
    if (!user.email_verified) {
      void recordLoginHistorySafely({
        req,
        userId: user.id,
        attemptedEmail: user.email,
        status: "failed",
        provider: "password",
        failureReason: "Email not verified",
      });

      return res.status(403).json({
        error: "Please verify your email before logging in. Check your inbox for the verification code.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const authSession = await issueAuthSession(req, res, user, "password");

    void recordLoginHistorySafely({
      req,
      userId: user.id,
      attemptedEmail: user.email,
      status: "success",
      provider: "password",
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      message: "Login successful",
      accessToken: authSession.accessToken,
      accessTokenExpiresIn: authSession.accessTokenExpiresIn,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// Google Sign-In / Sign-Up
router.post("/google", async (req, res) => {
  let attemptedEmail = null;

  try {
    const parsedBody = parsePayload(googleLoginSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const { idToken } = parsedBody.data;

    const allowedClientIds = getAllowedGoogleClientIds();
    if (!allowedClientIds.length) {
      void recordLoginHistorySafely({
        req,
        status: "failed",
        provider: "google",
        failureReason: "Google OAuth not configured",
      });
      return res.status(500).json({ error: "Google OAuth is not configured" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: allowedClientIds,
    });

    const payload = ticket.getPayload();
    attemptedEmail = String(payload?.email || "")
      .trim()
      .toLowerCase() || null;

    if (!payload || !payload.email || !payload.email_verified) {
      void recordLoginHistorySafely({
        req,
        attemptedEmail,
        status: "failed",
        provider: "google",
        failureReason: "Invalid Google payload",
      });
      return res.status(401).json({
        error: "Invalid Google account information or email not verified",
      });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    attemptedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const displayName = payload.name || email.split("@")[0] || "Google User";

    const [results] = await db.promise().query(
      "SELECT id, name, email, phone, address, profile_image, role, is_active, signup_provider, password_set_by_user, email_verified FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (results.length > 0) {
      const existingUser = results[0];

      if (!existingUser.is_active) {
        void recordLoginHistorySafely({
          req,
          userId: existingUser.id,
          attemptedEmail: existingUser.email,
          status: "failed",
          provider: "google",
          failureReason: "Account disabled",
        });
        return res.status(403).json({
          error: "Account is disabled. Please contact support.",
        });
      }

      if (isAccountLocked(existingUser)) {
        return res.status(423).json({
          error: "Account temporarily locked due to multiple failed attempts.",
        });
      }

      if (String(existingUser.role || "").trim().toLowerCase() === "admin") {
        return res.status(403).json({
          error: "Admin accounts must use the admin login page.",
          isAdmin: true,
          redirect: "/admin/login",
        });
      }

      await resetLoginFailures(existingUser.id);

      // Google has verified this email — clear any unverified flag so a user who
      // signed up with a password but never verified can still get in via Google.
      if (!existingUser.email_verified) {
        await db
          .promise()
          .query("UPDATE users SET email_verified = TRUE WHERE id = ?", [existingUser.id]);
      }

      const authSession = await issueAuthSession(req, res, existingUser, "google");

      void recordLoginHistorySafely({
        req,
        userId: existingUser.id,
        attemptedEmail: existingUser.email,
        status: "success",
        provider: "google",
      });

      res.setHeader("Cache-Control", "no-store");
      return res.json({
        message: "Google login successful",
        accessToken: authSession.accessToken,
        accessTokenExpiresIn: authSession.accessTokenExpiresIn,
        user: buildUserResponse(existingUser, {
          name: existingUser.name || displayName,
        }),
      });
    }

    const randomPassword = await bcrypt.hash(
      `google_${payload.sub}_${Date.now()}`,
      12,
    );

    const [insertResult] = await db.promise().query(
      `INSERT INTO users
        (name, email, password, role, signup_provider, password_set_by_user, email_verified, failed_login_attempts, locked_until)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, NULL)`,
      [displayName, email, randomPassword, "customer", "google", false],
    );

    const createdUser = {
      id: insertResult.insertId,
      name: displayName,
      email,
      phone: null,
      address: null,
      profile_image: null,
      signup_provider: "google",
      password_set_by_user: false,
      role: "customer",
    };

    const authSession = await issueAuthSession(req, res, createdUser, "google");

    void recordLoginHistorySafely({
      req,
      userId: insertResult.insertId,
      attemptedEmail: email,
      status: "success",
      provider: "google",
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({
      message: "Google signup successful",
      accessToken: authSession.accessToken,
      accessTokenExpiresIn: authSession.accessTokenExpiresIn,
      user: buildUserResponse(createdUser),
    });
  } catch (error) {
    let errorMessage = "Google authentication failed";
    if (String(error.message || "").includes("Token used too early")) {
      errorMessage = "Google token timing error. Please try again.";
    } else if (String(error.message || "").includes("Wrong number of segments")) {
      errorMessage = "Invalid Google token format";
    } else if (
      String(error.message || "").includes("Wrong recipient") ||
      String(error.message || "").includes("audience")
    ) {
      errorMessage = "Google Client ID mismatch. Please contact support.";
    } else if (String(error.message || "").includes("Invalid token signature")) {
      errorMessage = "Invalid Google token signature";
    } else if (String(error.message || "").includes("Token used too late")) {
      errorMessage = "Google token expired. Please try again.";
    }

    void recordLoginHistorySafely({
      req,
      attemptedEmail,
      status: "failed",
      provider: "google",
      failureReason: errorMessage,
    });

    return res.status(401).json({ error: errorMessage });
  }
});

// Get current user profile
router.get("/profile", authenticateToken, (req, res) => {
  db.query(
    "SELECT id, name, email, phone, address, role, profile_image, signup_provider, password_set_by_user, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(results[0]);
    },
  );
});

// Update user profile
router.put("/profile", authenticateToken, restrictBody('name', 'email', 'phone', 'address'), (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  const address = req.body?.address ? String(req.body.address).trim() : null;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const emailCheckQuery =
    "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1";
  db.query(emailCheckQuery, [email, req.user.id], (emailErr, emailResults) => {
    if (emailErr) {
      return res.status(500).json({ error: "Database error" });
    }

    if (emailResults.length > 0) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const updateQuery =
      "UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?";
    db.query(
      updateQuery,
      [name, email, phone, address, req.user.id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: "Error updating profile" });
        }

        const profileQuery =
          "SELECT id, name, email, phone, address, role, profile_image, signup_provider, password_set_by_user, created_at FROM users WHERE id = ?";
        db.query(profileQuery, [req.user.id], (profileErr, profileResults) => {
          if (profileErr) {
            return res.status(500).json({ error: "Database error" });
          }

          if (profileResults.length === 0) {
            return res.status(404).json({ error: "User not found" });
          }

          return res.json({
            message: "Profile updated successfully",
            user: profileResults[0],
          });
        });
      },
    );
  });
});

// Change password
router.put("/change-password", authenticateToken, restrictBody('currentPassword', 'newPassword'), async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!newPassword) {
      return res
        .status(400)
        .json({ error: "New password is required" });
    }

    const passwordValidation = strongPassword.safeParse(newPassword);
    if (!passwordValidation.success) {
      return res.status(400).json({
        error:
          passwordValidation.error.issues[0]?.message ||
          "Password does not meet security requirements",
      });
    }

    const connection = await db.promise().getConnection();

    try {
      await ensurePasswordHistoryTable(connection);

      db.query(
        "SELECT password, password_set_by_user FROM users WHERE id = ?",
        [req.user.id],
        async (err, results) => {
          if (err) {
            connection.release();
            return res.status(500).json({ error: "Database error" });
          }

          if (!results.length) {
            connection.release();
            return res.status(404).json({ error: "User not found" });
          }

          const requiresCurrentPassword = toBooleanFlag(
            results[0].password_set_by_user,
            true,
          );

          if (requiresCurrentPassword && !currentPassword) {
            connection.release();
            return res
              .status(400)
              .json({ error: "Current password is required" });
          }

          if (requiresCurrentPassword) {
            const isValidPassword = await bcrypt.compare(
              currentPassword,
              results[0].password,
            );
            if (!isValidPassword) {
              connection.release();
              return res
                .status(401)
                .json({ error: "Current password is incorrect" });
            }
          }

          const reusedPassword = await hasReusedPassword(
            connection,
            req.user.id,
            newPassword,
            5
          );

          if (reusedPassword) {
            connection.release();
            return res.status(400).json({
              error: "You cannot reuse any of your last 5 passwords. Please choose a different password.",
            });
          }

          const hashedPassword = await bcrypt.hash(newPassword, 12);

          db.query(
            "UPDATE users SET password = ?, password_set_by_user = TRUE WHERE id = ?",
            [hashedPassword, req.user.id],
            async (err, result) => {
              if (err) {
                connection.release();
                return res.status(500).json({ error: "Error updating password" });
              }

              await addPasswordToHistory(connection, req.user.id, newPassword);
              connection.release();

              res.json({ message: "Password changed successfully" });
            },
          );
        },
      );
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Upload/Update profile image
router.post(
  "/profile/image",
  authenticateToken,
  uploadProfileImage,
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const imageUrl = req.file.url;

      // Update user's profile image in database
      const query = "UPDATE users SET profile_image = ? WHERE id = ?";
      db.query(query, [imageUrl, req.user.id], (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error updating profile image" });
        }

        res.json({
          message: "Profile image updated successfully",
          imageUrl: imageUrl,
        });
      });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },
);

// Delete profile image
router.delete("/profile/image", authenticateToken, (req, res) => {
  const query = "UPDATE users SET profile_image = NULL WHERE id = ?";
  db.query(query, [req.user.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Error deleting profile image" });
    }

    res.json({ message: "Profile image deleted successfully" });
  });
});

// Get saved addresses for current user
router.get("/addresses", authenticateToken, (req, res) => {
  const query = `
        SELECT *
        FROM user_addresses
        WHERE user_id = ? AND is_active = TRUE
        ORDER BY is_default DESC, updated_at DESC
    `;

  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);
  });
});

// Upsert default address from checkout/profile
router.put("/addresses/default", authenticateToken, restrictBody('recipient_name', 'phone', 'line1', 'address', 'city', 'postal_code', 'state', 'country', 'line2', 'label'), (req, res) => {
  const recipientName = String(req.body?.recipient_name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const line1 = String(req.body?.line1 || req.body?.address || "").trim();
  const city = String(req.body?.city || "").trim();
  const postalCode = String(req.body?.postal_code || "").trim();
  const state = String(req.body?.state || "").trim();
  const country = String(req.body?.country || "Pakistan").trim();
  const line2 = String(req.body?.line2 || "").trim() || null;
  const label = String(req.body?.label || "Default").trim();

  if (!recipientName || !phone || !line1 || !city) {
    return res
      .status(400)
      .json({ error: "Recipient name, phone, address and city are required" });
  }

  db.query(
    "SELECT id FROM user_addresses WHERE user_id = ? AND is_default = TRUE LIMIT 1",
    [req.user.id],
    (findErr, existingRows) => {
      if (findErr) {
        return res.status(500).json({ error: "Database error" });
      }

      const finalizeResponse = (addressId) => {
        db.query(
          "SELECT * FROM user_addresses WHERE id = ? LIMIT 1",
          [addressId],
          (readErr, readRows) => {
            if (readErr || readRows.length === 0) {
              return res.status(500).json({ error: "Could not load address" });
            }

            return res.json({
              message: "Default address saved successfully",
              address: readRows[0],
            });
          },
        );
      };

      if (existingRows.length > 0) {
        const updateQuery = `
                    UPDATE user_addresses
                    SET label = ?, recipient_name = ?, phone = ?, line1 = ?, line2 = ?,
                        city = ?, state = ?, postal_code = ?, country = ?, is_active = TRUE
                    WHERE id = ? AND user_id = ?
                `;

        db.query(
          updateQuery,
          [
            label,
            recipientName,
            phone,
            line1,
            line2,
            city,
            state || null,
            postalCode || null,
            country,
            existingRows[0].id,
            req.user.id,
          ],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: "Error updating address" });
            }

            return finalizeResponse(existingRows[0].id);
          },
        );

        return;
      }

      db.query(
        `INSERT INTO user_addresses
                (user_id, label, recipient_name, phone, line1, line2, city, state, postal_code, country, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          req.user.id,
          label,
          recipientName,
          phone,
          line1,
          line2,
          city,
          state || null,
          postalCode || null,
          country,
        ],
        (insertErr, insertResult) => {
          if (insertErr) {
            return res.status(500).json({ error: "Error saving address" });
          }

          return finalizeResponse(insertResult.insertId);
        },
      );
    },
  );
});

// Add a new address
router.post("/addresses", authenticateToken, restrictBody('recipient_name', 'phone', 'line1', 'city', 'state', 'postal_code', 'country', 'label', 'line2'), (req, res) => {
  const recipientName = String(req.body?.recipient_name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const line1 = String(req.body?.line1 || "").trim();
  const city = String(req.body?.city || "").trim();
  const state = String(req.body?.state || "").trim();
  const postalCode = String(req.body?.postal_code || "").trim();
  const country = String(req.body?.country || "Pakistan").trim();
  const label = String(req.body?.label || "Home").trim();
  const line2 = String(req.body?.line2 || "").trim() || null;
  const makeDefault = Boolean(req.body?.is_default);

  if (!recipientName || !phone || !line1 || !city) {
    return res
      .status(400)
      .json({ error: "Recipient name, phone, address and city are required" });
  }

  const insertAddress = () => {
    db.query(
      `INSERT INTO user_addresses
            (user_id, label, recipient_name, phone, line1, line2, city, state, postal_code, country, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        label,
        recipientName,
        phone,
        line1,
        line2,
        city,
        state || null,
        postalCode || null,
        country,
        makeDefault,
      ],
      (insertErr, insertResult) => {
        if (insertErr) {
          return res.status(500).json({ error: "Error creating address" });
        }

        db.query(
          "SELECT * FROM user_addresses WHERE id = ?",
          [insertResult.insertId],
          (readErr, rows) => {
            if (readErr || rows.length === 0) {
              return res
                .status(500)
                .json({ error: "Address created but could not be loaded" });
            }

            return res.status(201).json({
              message: "Address added successfully",
              address: rows[0],
            });
          },
        );
      },
    );
  };

  if (!makeDefault) {
    insertAddress();
    return;
  }

  db.query(
    "UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?",
    [req.user.id],
    (resetErr) => {
      if (resetErr) {
        return res
          .status(500)
          .json({ error: "Error resetting default address" });
      }

      insertAddress();
    },
  );
});

// Update existing address
router.put("/addresses/:id", authenticateToken, restrictBody('recipient_name', 'phone', 'line1', 'city', 'state', 'postal_code', 'country', 'label', 'line2'), (req, res) => {
  const recipientName = String(req.body?.recipient_name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const line1 = String(req.body?.line1 || "").trim();
  const city = String(req.body?.city || "").trim();
  const state = String(req.body?.state || "").trim();
  const postalCode = String(req.body?.postal_code || "").trim();
  const country = String(req.body?.country || "Pakistan").trim();
  const label = String(req.body?.label || "Home").trim();
  const line2 = String(req.body?.line2 || "").trim() || null;

  if (!recipientName || !phone || !line1 || !city) {
    return res
      .status(400)
      .json({ error: "Recipient name, phone, address and city are required" });
  }

  db.query(
    `UPDATE user_addresses
         SET label = ?, recipient_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?, postal_code = ?, country = ?
         WHERE id = ? AND user_id = ?`,
    [
      label,
      recipientName,
      phone,
      line1,
      line2,
      city,
      state || null,
      postalCode || null,
      country,
      req.params.id,
      req.user.id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error updating address" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Address not found" });
      }

      db.query(
        "SELECT * FROM user_addresses WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
        (readErr, rows) => {
          if (readErr || rows.length === 0) {
            return res
              .status(500)
              .json({ error: "Address updated but could not be loaded" });
          }

          return res.json({
            message: "Address updated successfully",
            address: rows[0],
          });
        },
      );
    },
  );
});

// Set default address
router.patch("/addresses/:id/default", authenticateToken, restrictBody(), (req, res) => {
  db.query(
    "SELECT id FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1",
    [req.params.id, req.user.id],
    (findErr, rows) => {
      if (findErr) {
        return res.status(500).json({ error: "Database error" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "Address not found" });
      }

      db.query(
        "UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?",
        [req.user.id],
        (resetErr) => {
          if (resetErr) {
            return res.status(500).json({ error: "Error updating addresses" });
          }

          db.query(
            "UPDATE user_addresses SET is_default = TRUE WHERE id = ? AND user_id = ?",
            [req.params.id, req.user.id],
            (setErr) => {
              if (setErr) {
                return res
                  .status(500)
                  .json({ error: "Error setting default address" });
              }

              return res.json({
                message: "Default address updated successfully",
              });
            },
          );
        },
      );
    },
  );
});

// Soft-delete address
router.delete("/addresses/:id", authenticateToken, (req, res) => {
  db.query(
    "UPDATE user_addresses SET is_active = FALSE, is_default = FALSE WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error deleting address" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Address not found" });
      }

      res.json({ message: "Address removed successfully" });
    },
  );
});

// Get notifications for current user
router.get("/notifications", authenticateToken, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  db.query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [req.user.id, limit],
    (err, rows) => {
      if (err) {
        console.error("[auth] notifications list failed:", err.message);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows);
    },
  );
});

// Cheap unread-count endpoint for the navbar bell badge
router.get("/notifications/unread-count", authenticateToken, (req, res) => {
  db.query(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = FALSE",
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error("[auth] notifications unread-count failed:", err.message);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ count: Number(rows?.[0]?.c) || 0 });
    },
  );
});

// Mark single notification as read
router.patch("/notifications/:id/read", authenticateToken, restrictBody(), (req, res) => {
  db.query(
    "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error updating notification" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json({ message: "Notification marked as read" });
    },
  );
});

// Mark all notifications as read
router.patch("/notifications/read-all", authenticateToken, restrictBody(), (req, res) => {
  db.query(
    "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE",
    [req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error updating notifications" });
      }

      res.json({
        message: "All notifications marked as read",
        updated: result.affectedRows,
      });
    },
  );
});

// Delete a single notification
router.delete("/notifications/:id", authenticateToken, restrictBody(), (req, res) => {
  db.query(
    "DELETE FROM notifications WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Error deleting notification" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ message: "Notification deleted" });
    },
  );
});

// Clear notifications — all by default, or only read ones with ?read=true
router.delete("/notifications", authenticateToken, restrictBody(), (req, res) => {
  const readOnly = String(req.query.read || "").toLowerCase() === "true";
  const sql = readOnly
    ? "DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE"
    : "DELETE FROM notifications WHERE user_id = ?";
  db.query(sql, [req.user.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Error clearing notifications" });
    }
    res.json({ message: "Notifications cleared", deleted: result.affectedRows });
  });
});

// Get notification mute settings
router.get("/notifications/settings", authenticateToken, (req, res) => {
  db.query(
    "SELECT is_muted, muted_until FROM user_notification_settings WHERE user_id = ? LIMIT 1",
    [req.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error loading notification settings" });
      }

      const row = rows[0];
      if (!row) {
        return res.json({
          isMuted: false,
          mutedUntil: null,
        });
      }

      const mutedUntilDate = row.muted_until ? new Date(row.muted_until) : null;
      const hasValidMutedUntil = Boolean(
        mutedUntilDate && !Number.isNaN(mutedUntilDate.getTime()),
      );

      const muteExpired =
        Boolean(row.is_muted) &&
        hasValidMutedUntil &&
        mutedUntilDate <= new Date();

      if (muteExpired) {
        db.query(
          "UPDATE user_notification_settings SET is_muted = FALSE, muted_until = NULL WHERE user_id = ?",
          [req.user.id],
          () => {},
        );

        return res.json({
          isMuted: false,
          mutedUntil: null,
        });
      }

      return res.json({
        isMuted: Boolean(row.is_muted),
        mutedUntil: hasValidMutedUntil ? mutedUntilDate.toISOString() : null,
      });
    },
  );
});

// Update notification mute settings
router.put("/notifications/settings", authenticateToken, restrictBody('isMuted', 'mutedForMinutes'), (req, res) => {
  const isMuted = Boolean(req.body?.isMuted);
  const rawMutedForMinutes = Number.parseInt(req.body?.mutedForMinutes, 10);
  const mutedForMinutes =
    Number.isFinite(rawMutedForMinutes) && rawMutedForMinutes > 0
      ? Math.min(rawMutedForMinutes, 10080)
      : null;

  const mutedUntilDate =
    isMuted && mutedForMinutes
      ? new Date(Date.now() + mutedForMinutes * 60 * 1000)
      : null;

  db.query(
    `INSERT INTO user_notification_settings (user_id, is_muted, muted_until)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_muted = VALUES(is_muted),
       muted_until = VALUES(muted_until),
       updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, isMuted, mutedUntilDate],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Error updating notification settings" });
      }

      return res.json({
        message: "Notification settings updated",
        isMuted,
        mutedUntil: mutedUntilDate ? mutedUntilDate.toISOString() : null,
      });
    },
  );
});

// Forgot Password - Send reset link
router.post("/forgot-password", async (req, res) => {
  try {
    const parsedBody = parsePayload(forgotPasswordSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const normalizedEmail = String(parsedBody.data.email || "")
      .trim()
      .toLowerCase();

    // Always return success message for security (don't reveal if email exists)
    const successResponse = {
      message: "If an account exists with this email, a password reset link will be sent shortly.",
      success: true,
    };

    // Find user by email
    const [users] = await db
      .promise()
      .query("SELECT id, name, email, is_active FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);

    // If no user found, return success (security: don't reveal email existence)
    if (!users.length) {
      return res.json(successResponse);
    }

    const user = users[0];

    // Check if user account is active
    if (!user.is_active) {
      return res.json(successResponse);
    }

    // Create password reset token
    const tokenData = await createPasswordResetToken(db.promise(), user.id, user.email);

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, user.name, tokenData.token);

    if (!emailResult.success) {
      // Still return success to user (don't reveal email sending issues)
      // But log the error for debugging
    } else {
    }

    return res.json(successResponse);
  } catch (error) {
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
});

// Reset Password - Verify token and update password
router.post("/reset-password", async (req, res) => {
  try {
    const parsedBody = parsePayload(resetPasswordSchema, req.body || {});
    if (!parsedBody.ok) {
      return res.status(400).json({ error: parsedBody.error });
    }

    const { token, newPassword } = parsedBody.data;

    if (!token) {
      return res.status(400).json({ error: "Reset token is required" });
    }

    // Validate the reset token
    const tokenValidation = await validatePasswordResetToken(db.promise(), token);

    if (!tokenValidation) {
      return res.status(400).json({ 
        error: "Invalid or expired reset link. Please request a new password reset.",
        success: false,
      });
    }

    if (!tokenValidation.valid) {
      return res.status(400).json({ 
        error: tokenValidation.reason || "Invalid or expired reset link. Please request a new password reset.",
        success: false,
      });
    }

    // Validate password strength (already validated by schema, but double-check)
    const passwordValidation = strongPassword.safeParse(newPassword);
    if (!passwordValidation.success) {
      return res.status(400).json({
        error: passwordValidation.error.issues[0]?.message || "Password does not meet security requirements",
        success: false,
      });
    }

    const connection = await db.promise().getConnection();
    await ensurePasswordHistoryTable(connection);

    const [userRows] = await connection.query(
      "SELECT password FROM users WHERE id = ?",
      [tokenValidation.userId]
    );

    if (userRows.length && userRows[0].password) {
      const isSamePassword = await bcrypt.compare(newPassword, userRows[0].password);
      if (isSamePassword) {
        connection.release();
        return res.status(400).json({
          error: "New password must be different from your current password.",
          success: false,
        });
      }
    }

    const reusedPassword = await hasReusedPassword(connection, tokenValidation.userId, newPassword, 5);
    if (reusedPassword) {
      connection.release();
      return res.status(400).json({
        error: "You cannot reuse any of your last 5 passwords. Please choose a different password.",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await connection.query(
      "UPDATE users SET password = ?, password_set_by_user = TRUE WHERE id = ?",
      [hashedPassword, tokenValidation.userId]
    );

    await addPasswordToHistory(connection, tokenValidation.userId, newPassword);

    connection.release();

    await markTokenAsUsed(db.promise(), tokenValidation.tokenId);

    await invalidateAllUserTokens(db.promise(), tokenValidation.userId);

    await revokeSessionsByUserId(db.promise(), tokenValidation.userId);
    await revokeRefreshTokensByUserId(
      db.promise(),
      tokenValidation.userId,
      "password_reset",
    );


    return res.json({
      message: "Password reset successfully. You can now log in with your new password.",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
});

// Refresh Access Token
router.post("/refresh", restrictBody(), async (req, res) => {
  const refreshToken = req.cookies?.[JWT_RUNTIME.refreshCookieName];

  if (!refreshToken) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh token is required" });
  }

  let refreshPayload;
  try {
    refreshPayload = verifyRefreshToken(refreshToken);
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  try {
    const refreshRecord = await findActiveRefreshTokenRecord(db.promise(), {
      refreshTokenJti: refreshPayload.jti,
      refreshToken,
    });

    const refreshUserId = Number(refreshPayload.sub || 0);
    if (
      !refreshRecord ||
      !Number.isInteger(refreshUserId) ||
      refreshUserId <= 0 ||
      Number(refreshRecord.user_id) !== refreshUserId ||
      refreshRecord.isRevoked ||
      refreshRecord.isExpired
    ) {
      if (Number.isInteger(refreshUserId) && refreshUserId > 0) {
        await revokeRefreshTokensByUserId(
          db.promise(),
          refreshUserId,
          "invalid_or_reused_refresh_token",
        );
      }

      clearRefreshCookie(res);
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const [sessionRows] = await db.promise().query(
      "SELECT id, is_active FROM user_sessions WHERE id = ? AND user_id = ? LIMIT 1",
      [refreshRecord.session_id, refreshRecord.user_id],
    );

    if (!sessionRows.length || !sessionRows[0].is_active) {
      await revokeRefreshTokensBySessionId(
        db.promise(),
        refreshRecord.session_id,
        "session_inactive",
      );
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Session revoked. Please log in again." });
    }

    const [userRows] = await db.promise().query(
      `SELECT
          id, name, email, phone, address, profile_image,
          signup_provider, password_set_by_user, role, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [refreshRecord.user_id],
    );

    if (!userRows.length || !userRows[0].is_active) {
      await revokeRefreshTokensByUserId(
        db.promise(),
        refreshRecord.user_id,
        "account_inactive",
      );
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Session invalid. Please log in again." });
    }

    const user = userRows[0];
    const nextAccess = issueAccessToken(user);
    const nextRefresh = issueRefreshToken(user);
    const nextRefreshPayload = verifyRefreshToken(nextRefresh.token);
    const nextRefreshExpiry = toExpiryDate(nextRefreshPayload);

    await rotateRefreshTokenRecord(db.promise(), {
      oldRefreshTokenJti: refreshPayload.jti,
      newRefreshToken: nextRefresh.token,
      newRefreshTokenJti: nextRefresh.jti,
      expiresAt: nextRefreshExpiry,
      userId: user.id,
      sessionId: refreshRecord.session_id,
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || null,
    });

    await touchRefreshTokenByJti(db.promise(), nextRefresh.jti);
    await updateSessionToken(db.promise(), refreshRecord.session_id, nextAccess.token);

    res.cookie(
      JWT_RUNTIME.refreshCookieName,
      nextRefresh.token,
      getRefreshCookieOptions(),
    );

    return res.json({
      message: "Token refreshed successfully",
      accessToken: nextAccess.token,
      accessTokenExpiresIn: nextAccess.expiresInSeconds,
      user: buildUserResponse(user),
    });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// Logout
router.post("/logout", restrictBody(), async (req, res) => {
  const token = getBearerToken(req);
  const refreshToken = req.cookies?.[JWT_RUNTIME.refreshCookieName];

  try {
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const expiryDate = toExpiryDate(payload);
        await blacklistAccessToken(db.promise(), {
          jti: payload.jti,
          userId: Number(payload.sub || 0) || null,
          token,
          expiresAt: expiryDate,
          reason: "logout",
        });
      } catch (error) {
        // Access token may already be expired; session revocation below still applies.
      }

      await revokeSessionByToken(db.promise(), token);
    }

    if (refreshToken) {
      try {
        const refreshPayload = verifyRefreshToken(refreshToken);
        const refreshRecord = await findActiveRefreshTokenRecord(db.promise(), {
          refreshTokenJti: refreshPayload.jti,
          refreshToken,
        });

        if (refreshRecord?.session_id) {
          await revokeSessionById(db.promise(), refreshRecord.session_id);
          await revokeRefreshTokensBySessionId(
            db.promise(),
            refreshRecord.session_id,
            "logout",
          );
        }

        await revokeRefreshTokenByJti(db.promise(), refreshPayload.jti, "logout");
      } catch (error) {
        // Refresh cookie may already be invalid or expired.
      }
    }
  } catch (error) {
    // Keep logout success response deterministic for clients.
  } finally {
    clearRefreshCookie(res);
  }

  return res.json({
    message: "Logged out successfully",
    success: true,
  });
});

module.exports = router;


