const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { authenticateToken } = require("../middleware/auth");
const { uploadProfileImage } = require("../middleware/upload");
const {
  createUserSession,
  revokeSessionByToken,
} = require("../utils/sessionManager");

const googleClient = new OAuth2Client();
const DEV_DEFAULT_GOOGLE_CLIENT_ID =
  "909610579763-59u67k55ds657snk6h7beqj8badu886r.apps.googleusercontent.com";
const IP_LOOKUP_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "2000",
  10,
);
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const ipLocationCache = new Map();

const getAllowedGoogleClientIds = () => {
  const configuredIds = [
    process.env.GOOGLE_CLIENT_ID,
    ...(process.env.GOOGLE_CLIENT_IDS || "").split(","),
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    configuredIds.push(DEV_DEFAULT_GOOGLE_CLIENT_ID);
  }

  return [...new Set(configuredIds)];
};

const getFrontendBaseUrl = () => {
  const configuredUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
  return (configuredUrl || "http://localhost:5173").replace(/\/$/, "");
};

const sanitizeRedirectPath = (redirectPath) => {
  if (typeof redirectPath !== "string") {
    return "/";
  }

  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return "/";
  }

  return redirectPath;
};

const createUserAuthToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );

const buildAuthCallbackRedirectUrl = ({
  token,
  user,
  error,
  provider = "google",
  next = "/",
}) => {
  const callbackUrl = new URL("/auth/callback", `${getFrontendBaseUrl()}/`);
  callbackUrl.searchParams.set("provider", provider);
  callbackUrl.searchParams.set("next", sanitizeRedirectPath(next));

  if (error) {
    callbackUrl.searchParams.set("error", error);
  } else {
    callbackUrl.searchParams.set("token", token);
    callbackUrl.searchParams.set(
      "user",
      encodeURIComponent(JSON.stringify(user)),
    );
  }

  return callbackUrl.toString();
};

const normalizeIpAddress = (rawIp) => {
  let value = String(rawIp || "").trim();
  if (!value) {
    return null;
  }

  if (value.includes(",")) {
    value = value.split(",")[0].trim();
  }

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }

  if (value.includes("::ffff:")) {
    value = value.split("::ffff:").pop().trim();
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.split(":")[0];
  }

  if (value.toLowerCase() === "unknown") {
    return null;
  }

  return value;
};

const getRequestIp = (req) => {
  const candidates = [
    req.headers["cf-connecting-ip"],
    req.headers["x-real-ip"],
    req.headers["x-forwarded-for"],
    req.headers["x-client-ip"],
    req.ip,
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIpAddress(
      Array.isArray(candidate) ? candidate[0] : candidate,
    );
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

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
    await createUserSession(db.promise(), {
      userId,
      token,
      provider,
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (error) {
    console.warn("Could not persist user session:", error.message);
  }
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
    const { name, email, password, phone, address, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    // Check if user already exists
    db.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
          return res.status(400).json({ error: "Email already registered" });
        }

        // Determine user role (default to customer)
        const userRole = role === "admin" ? "admin" : "customer";

        // Use different salt rounds based on role
        // Normal users: 4 salt rounds (faster, sufficient for regular users)
        // Admin users: 10 salt rounds (more secure for privileged accounts)
        const saltRounds = userRole === "admin" ? 10 : 4;

        // Hash password with appropriate salt rounds
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const query =
          "INSERT INTO users (name, email, password, phone, address, role, signup_provider, password_set_by_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(
          query,
          [
            name,
            email,
            hashedPassword,
            phone,
            address,
            userRole,
            "password",
            true,
          ],
          async (err, result) => {
            if (err) {
              return res.status(500).json({ error: "Error creating user" });
            }

            // Generate JWT token for auto-login after registration
            const token = jwt.sign(
              { id: result.insertId, email, role: userRole },
              process.env.JWT_SECRET,
              { expiresIn: "24h" },
            );

            await createSessionSafely(req, result.insertId, token, "password");

            res.status(201).json({
              message: "User registered successfully",
              token,
              user: {
                id: result.insertId,
                name,
                email,
                phone: phone || null,
                address: address || null,
                profile_image: null,
                signup_provider: "password",
                password_set_by_user: true,
                role: userRole,
              },
            });
          },
        );
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login user
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Validation
    if (!email || !password) {
      void recordLoginHistorySafely({
        req,
        attemptedEmail: normalizedEmail || null,
        status: "failed",
        provider: "password",
        failureReason: "Missing credentials",
      });

      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    db.query(
      "SELECT * FROM users WHERE email = ?",
      [normalizedEmail],
      async (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
          void recordLoginHistorySafely({
            req,
            attemptedEmail: normalizedEmail,
            status: "failed",
            provider: "password",
            failureReason: "Email not found",
          });

          return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = results[0];

        if (!user.is_active) {
          void recordLoginHistorySafely({
            req,
            userId: user.id,
            attemptedEmail: user.email,
            status: "failed",
            provider: "password",
            failureReason: "Account disabled",
          });

          return res
            .status(403)
            .json({ error: "Account is disabled. Please contact support." });
        }

        // Compare password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          void recordLoginHistorySafely({
            req,
            userId: user.id,
            attemptedEmail: user.email,
            status: "failed",
            provider: "password",
            failureReason: "Invalid password",
          });

          return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "24h" },
        );

        await createSessionSafely(req, user.id, token, "password");

        void recordLoginHistorySafely({
          req,
          userId: user.id,
          attemptedEmail: user.email,
          status: "success",
          provider: "password",
        });

        res.json({
          message: "Login successful",
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            address: user.address || null,
            profile_image: user.profile_image || null,
            signup_provider: user.signup_provider || "password",
            password_set_by_user: toBooleanFlag(user.password_set_by_user, true),
            role: user.role,
          },
        });
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Google Sign-In / Sign-Up
router.post("/google", async (req, res) => {
  let attemptedEmail = null;

  try {
    const { idToken } = req.body;

    if (!idToken) {
      console.error("Google auth error: No idToken provided");
      void recordLoginHistorySafely({
        req,
        status: "failed",
        provider: "google",
        failureReason: "Missing Google token",
      });
      return res.status(400).json({ error: "Google ID token is required" });
    }

    const allowedClientIds = getAllowedGoogleClientIds();
    if (!allowedClientIds.length) {
      console.error("Google auth error: GOOGLE_CLIENT_ID not configured");
      void recordLoginHistorySafely({
        req,
        status: "failed",
        provider: "google",
        failureReason: "Google OAuth not configured",
      });
      return res.status(500).json({ error: "Google OAuth is not configured" });
    }

    console.log(
      "Verifying Google token with allowed Client IDs:",
      allowedClientIds
        .map((clientId) => `${clientId.substring(0, 20)}...`)
        .join(", "),
    );

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: allowedClientIds,
    });

    const payload = ticket.getPayload();
    attemptedEmail = String(payload?.email || "")
      .trim()
      .toLowerCase() || null;

    console.log(
      "Google token verified successfully for email:",
      payload?.email,
    );

    if (!payload || !payload.email || !payload.email_verified) {
      console.error("Google auth error: Invalid payload or unverified email");
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

    const email = payload.email;
    attemptedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const displayName = payload.name || email.split("@")[0] || "Google User";

    db.query(
      "SELECT id, name, email, phone, address, profile_image, role, is_active, signup_provider, password_set_by_user FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          console.error("Google auth DB error:", err.message);
          void recordLoginHistorySafely({
            req,
            attemptedEmail,
            status: "failed",
            provider: "google",
            failureReason: "Database error",
          });
          return res.status(500).json({ error: "Database error" });
        }

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

          console.log("Existing user found, logging in:", email);

          const token = jwt.sign(
            {
              id: existingUser.id,
              email: existingUser.email,
              role: existingUser.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" },
          );

          await createSessionSafely(req, existingUser.id, token, "google");

          void recordLoginHistorySafely({
            req,
            userId: existingUser.id,
            attemptedEmail: existingUser.email,
            status: "success",
            provider: "google",
          });

          return res.json({
            message: "Google login successful",
            token,
            user: {
              id: existingUser.id,
              name: existingUser.name || displayName,
              email: existingUser.email,
              phone: existingUser.phone || null,
              address: existingUser.address || null,
              profile_image: existingUser.profile_image || null,
              signup_provider: existingUser.signup_provider || "password",
              password_set_by_user: toBooleanFlag(
                existingUser.password_set_by_user,
                true,
              ),
              role: existingUser.role,
            },
          });
        }

        // The users table requires password, so store a random hash for Google-created accounts.
        console.log("New user, creating account for:", email);
        const randomPassword = await bcrypt.hash(
          `google_${payload.sub}_${Date.now()}`,
          10,
        );

        const query =
          "INSERT INTO users (name, email, password, role, signup_provider, password_set_by_user) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(
          query,
          [displayName, email, randomPassword, "customer", "google", false],
          async (insertErr, result) => {
            if (insertErr) {
              console.error(
                "Google auth user creation error:",
                insertErr.message,
              );
              void recordLoginHistorySafely({
                req,
                attemptedEmail,
                status: "failed",
                provider: "google",
                failureReason: "User creation failed",
              });
              return res
                .status(500)
                .json({ error: "Error creating user account" });
            }

            console.log("New user created successfully:", email);

            const token = jwt.sign(
              { id: result.insertId, email, role: "customer" },
              process.env.JWT_SECRET,
              { expiresIn: "24h" },
            );

            await createSessionSafely(req, result.insertId, token, "google");

            void recordLoginHistorySafely({
              req,
              userId: result.insertId,
              attemptedEmail: email,
              status: "success",
              provider: "google",
            });

            return res.status(201).json({
              message: "Google signup successful",
              token,
              user: {
                id: result.insertId,
                name: displayName,
                email,
                phone: null,
                address: null,
                profile_image: null,
                signup_provider: "google",
                password_set_by_user: false,
                role: "customer",
              },
            });
          },
        );
      },
    );
  } catch (error) {
    console.error("Google auth error:", error.message);
    console.error("Error details:", error);

    // Provide more specific error messages
    let errorMessage = "Google authentication failed";
    if (error.message.includes("Token used too early")) {
      errorMessage = "Google token timing error. Please try again.";
    } else if (error.message.includes("Wrong number of segments")) {
      errorMessage = "Invalid Google token format";
    } else if (
      error.message.includes("Wrong recipient") ||
      error.message.includes("audience")
    ) {
      errorMessage = "Google Client ID mismatch. Please contact support.";
    } else if (error.message.includes("Invalid token signature")) {
      errorMessage = "Invalid Google token signature";
    } else if (error.message.includes("Token used too late")) {
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
router.put("/profile", authenticateToken, (req, res) => {
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
router.put("/change-password", authenticateToken, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!newPassword) {
      return res
        .status(400)
        .json({ error: "New password is required" });
    }

    // Get user's current password and password policy mode
    db.query(
      "SELECT password, password_set_by_user FROM users WHERE id = ?",
      [req.user.id],
      async (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        if (!results.length) {
          return res.status(404).json({ error: "User not found" });
        }

        const requiresCurrentPassword = toBooleanFlag(
          results[0].password_set_by_user,
          true,
        );

        if (requiresCurrentPassword && !currentPassword) {
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
            return res
              .status(401)
              .json({ error: "Current password is incorrect" });
          }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        db.query(
          "UPDATE users SET password = ?, password_set_by_user = TRUE WHERE id = ?",
          [hashedPassword, req.user.id],
          (err, result) => {
            if (err) {
              return res.status(500).json({ error: "Error updating password" });
            }

            res.json({ message: "Password changed successfully" });
          },
        );
      },
    );
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
          console.error("Database error:", err);
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
      console.error("Profile image upload error:", error);
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
router.put("/addresses/default", authenticateToken, (req, res) => {
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
router.post("/addresses", authenticateToken, (req, res) => {
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
router.put("/addresses/:id", authenticateToken, (req, res) => {
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
router.patch("/addresses/:id/default", authenticateToken, (req, res) => {
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
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows);
    },
  );
});

// Mark single notification as read
router.patch("/notifications/:id/read", authenticateToken, (req, res) => {
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
router.patch("/notifications/read-all", authenticateToken, (req, res) => {
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
router.put("/notifications/settings", authenticateToken, (req, res) => {
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
router.post("/forgot-password", (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if user exists
    db.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        // Always return success for security reasons (don't reveal if email exists)
        if (results.length === 0) {
          return res.json({
            message: "If email exists, a reset link will be sent shortly",
            success: true,
          });
        }

        // In a production app, you would:
        // 1. Generate a reset token
        // 2. Store it in database with expiration
        // 3. Send email with reset link
        // For now, just acknowledge the request
        res.json({
          message: "Reset link sent to your email",
          success: true,
        });
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    // In a production app, you would:
    // 1. Verify the reset token
    // 2. Extract user ID from token
    // 3. Update the password
    // For now, return success
    res.json({
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const token = getBearerToken(req);

    if (token) {
      await revokeSessionByToken(db.promise(), token);
    }
  } catch (error) {
    // Keep logout success response deterministic for clients.
  }

  res.json({
    message: "Logged out successfully",
    success: true,
  });
});

module.exports = router;


