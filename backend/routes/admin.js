const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const {
  createUserSession,
  revokeSessionByToken,
} = require("../utils/sessionManager");

const IP_LOOKUP_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "2000",
  10,
);
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const adminLoginLocationCache = new Map();

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

const getCachedLocationForIp = (ipAddress) => {
  const cacheEntry = adminLoginLocationCache.get(ipAddress);
  if (!cacheEntry) {
    return null;
  }

  if (Date.now() - cacheEntry.timestamp > LOCATION_CACHE_TTL_MS) {
    adminLoginLocationCache.delete(ipAddress);
    return null;
  }

  return cacheEntry.location;
};

const setCachedLocationForIp = (ipAddress, location) => {
  adminLoginLocationCache.set(ipAddress, {
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

    if (location !== "Unknown") {
      setCachedLocationForIp(ipAddress, location);
    }

    return location;
  } catch (error) {
    return "Unknown";
  }
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

const recordAdminLoginHistorySafely = async ({
  req,
  userId = null,
  attemptedEmail = null,
  status = "failed",
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
        "admin-password",
        ipAddress,
        req.headers["user-agent"] || null,
        resolveDeviceName(req.headers["user-agent"] || ""),
        locationLabel,
        normalizedStatus,
        normalizedStatus === "failed" ? failureReason || "Authentication failed" : null,
      ],
    );
  } catch (error) {
    // Keep admin auth deterministic even if history logging fails.
  }
};

const getBearerToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

const ALLOWED_PAYMENT_METHOD_CODES = new Set([
  "cod",
  "card",
  "online",
  "easypaisa",
  "jazzcash",
]);

// Admin Login - NO authentication required for this endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Validation
    if (!email || !password) {
      void recordAdminLoginHistorySafely({
        req,
        attemptedEmail: normalizedEmail || null,
        status: "failed",
        failureReason: "Missing credentials",
      });

      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find user and verify they are an admin
    db.query(
      "SELECT * FROM users WHERE email = ?",
      [normalizedEmail],
      async (err, results) => {
        if (err) {
          void recordAdminLoginHistorySafely({
            req,
            attemptedEmail: normalizedEmail,
            status: "failed",
            failureReason: "Database error",
          });

          return res.status(500).json({
            success: false,
            error: "Database error",
          });
        }

        if (results.length === 0) {
          void recordAdminLoginHistorySafely({
            req,
            attemptedEmail: normalizedEmail,
            status: "failed",
            failureReason: "Email not found",
          });

          return res.status(401).json({
            success: false,
            error: "Invalid email or password",
          });
        }

        const user = results[0];

        if (!user.is_active) {
          void recordAdminLoginHistorySafely({
            req,
            userId: user.id,
            attemptedEmail: user.email,
            status: "failed",
            failureReason: "Account disabled",
          });

          return res.status(403).json({
            success: false,
            error: "Account is disabled. Contact super admin.",
          });
        }

        // Check if user is admin
        if (user.role !== "admin") {
          void recordAdminLoginHistorySafely({
            req,
            userId: user.id,
            attemptedEmail: user.email,
            status: "failed",
            failureReason: "Not an admin",
          });

          return res.status(403).json({
            success: false,
            error: "Access denied. Admin privileges required.",
          });
        }

        // Compare password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          void recordAdminLoginHistorySafely({
            req,
            userId: user.id,
            attemptedEmail: user.email,
            status: "failed",
            failureReason: "Invalid password",
          });

          return res.status(401).json({
            success: false,
            error: "Invalid email or password",
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "24h" },
        );

        try {
          await createUserSession(db.promise(), {
            userId: user.id,
            token,
            provider: "admin-password",
            ipAddress: getRequestIp(req),
            userAgent: req.headers["user-agent"] || null,
          });
        } catch (sessionError) {
          console.warn(
            "Could not persist admin session:",
            sessionError.message,
          );
        }

        void recordAdminLoginHistorySafely({
          req,
          userId: user.id,
          attemptedEmail: user.email,
          status: "success",
        });

        res.json({
          success: true,
          message: "Admin login successful",
          token,
          admin: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      },
    );
  } catch (error) {
    console.error("Admin login error:", error);
    void recordAdminLoginHistorySafely({
      req,
      attemptedEmail: String(req.body?.email || "")
        .trim()
        .toLowerCase() || null,
      status: "failed",
      failureReason: "Server error",
    });

    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// Admin Verify Token - Requires authentication
router.get("/verify", authenticateToken, isAdmin, (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// Admin Logout - Requires authentication
router.post("/logout", authenticateToken, isAdmin, (req, res) => {
  const token = getBearerToken(req);

  const finalizeLogout = () => {
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  };

  if (!token) {
    finalizeLogout();
    return;
  }

  revokeSessionByToken(db.promise(), token)
    .then(finalizeLogout)
    .catch(() => finalizeLogout());
});

// All other admin routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard statistics
router.get("/dashboard/stats", async (req, res) => {
  try {
    const [[userStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalUsers,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS activeUsers
             FROM users
             WHERE role = 'customer'`,
    );

    const [[productStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalProducts,
                SUM(CASE WHEN stock_quantity < 10 THEN 1 ELSE 0 END) AS lowStockProducts
             FROM products`,
    );

    const [[orderStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalOrders,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS totalRevenue,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processingOrders,
                SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shippedOrders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS deliveredOrders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders
             FROM orders`,
    );

    const [[contactStats]] = await db
      .promise()
      .query(
        'SELECT COUNT(*) AS newContacts FROM contacts WHERE status = "new"',
      );

    const [[returnStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalReturns,
                SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS pendingReturns,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refundedReturns
             FROM returns_requests`,
    );

    const [[refundStats]] = await db.promise().query(
      `SELECT
                COUNT(*) AS totalRefundTransactions,
                SUM(CASE WHEN status = 'processed' THEN amount ELSE 0 END) AS totalRefundAmount
             FROM refund_transactions`,
    );

    res.json({
      totalUsers: Number(userStats?.totalUsers || 0),
      activeUsers: Number(userStats?.activeUsers || 0),
      totalProducts: Number(productStats?.totalProducts || 0),
      lowStockProducts: Number(productStats?.lowStockProducts || 0),
      totalOrders: Number(orderStats?.totalOrders || 0),
      totalRevenue: Number(orderStats?.totalRevenue || 0),
      pendingOrders: Number(orderStats?.pendingOrders || 0),
      processingOrders: Number(orderStats?.processingOrders || 0),
      shippedOrders: Number(orderStats?.shippedOrders || 0),
      deliveredOrders: Number(orderStats?.deliveredOrders || 0),
      cancelledOrders: Number(orderStats?.cancelledOrders || 0),
      newContacts: Number(contactStats?.newContacts || 0),
      totalReturns: Number(returnStats?.totalReturns || 0),
      pendingReturns: Number(returnStats?.pendingReturns || 0),
      refundedReturns: Number(returnStats?.refundedReturns || 0),
      totalRefundTransactions: Number(
        refundStats?.totalRefundTransactions || 0,
      ),
      totalRefundAmount: Number(refundStats?.totalRefundAmount || 0),
    });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Recent orders
router.get("/dashboard/recent-orders", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const query = `
        SELECT o.*, u.name as customer_name, u.email as customer_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT ?
    `;

  db.query(query, [limit], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Sales report
router.get("/reports/sales", (req, res) => {
  const { start_date, end_date } = req.query;

  let query = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as orders,
            SUM(total_amount) as revenue,
            AVG(total_amount) as average_order_value
        FROM orders
        WHERE status != 'cancelled'
    `;
  const params = [];

  if (start_date && end_date) {
    query += " AND created_at BETWEEN ? AND ?";
    params.push(start_date, end_date);
  }

  query += " GROUP BY DATE(created_at) ORDER BY date DESC";

  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Product sales report
router.get("/reports/products", (req, res) => {
  const query = `
        SELECT 
            p.id, 
            p.name, 
            p.price,
            SUM(oi.quantity) as total_sold,
            SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        GROUP BY p.id
        ORDER BY total_sold DESC
        LIMIT 20
    `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Reviews management
router.get("/reviews", async (req, res) => {
  try {
    const status = String(req.query.status || "all").trim().toLowerCase();
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 120, 1),
      500,
    );

    let whereClause = "";
    if (status === "approved") {
      whereClause = "WHERE r.is_approved = TRUE";
    } else if (status === "pending") {
      whereClause = "WHERE r.is_approved = FALSE";
    }

    const [rows] = await db.promise().query(
      `SELECT
          r.id,
          r.product_id,
          r.user_id,
          r.rating,
          r.comment,
          r.is_approved,
          r.created_at,
          p.name AS product_name,
          u.name AS customer_name,
          u.email AS customer_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [limit],
    );

    res.json(
      rows.map((review) => ({
        ...review,
        is_approved: Boolean(review.is_approved),
      })),
    );
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.patch("/reviews/:id/approval", async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const isApproved =
      req.body?.is_approved === true ||
      req.body?.is_approved === 1 ||
      req.body?.is_approved === "1";

    const [result] = await db.promise().query(
      "UPDATE reviews SET is_approved = ? WHERE id = ?",
      [isApproved ? 1 : 0, reviewId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    const [rows] = await db.promise().query(
      `SELECT
          r.id,
          r.product_id,
          r.user_id,
          r.rating,
          r.comment,
          r.is_approved,
          r.created_at,
          p.name AS product_name,
          u.name AS customer_name,
          u.email AS customer_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?
       LIMIT 1`,
      [reviewId],
    );

    res.json({
      message: `Review ${isApproved ? "approved" : "unapproved"} successfully`,
      review: rows[0]
        ? {
            ...rows[0],
            is_approved: Boolean(rows[0].is_approved),
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  try {
    const includeAdmins = req.query.include_admins === "true";
    const [rows] = await db.promise().query(
      `SELECT
                u.id,
                u.name,
                u.email,
                u.phone,
                u.address,
                u.role,
                u.is_active,
                u.created_at,
                COUNT(DISTINCT o.id) AS orders_count,
                COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS total_spent
             FROM users u
             LEFT JOIN orders o ON o.user_id = u.id
               ${includeAdmins ? "" : "WHERE u.role = 'customer'"}
             GROUP BY u.id, u.name, u.email, u.phone, u.address, u.role, u.is_active, u.created_at
             ORDER BY u.created_at DESC`,
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Create user/customer
router.post("/users", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      role = "customer",
      is_active = true,
    } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const normalizedRole = String(role).trim().toLowerCase();
    if (!["customer", "admin"].includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordToHash =
      toNullableString(password) ||
      `Temp@${Math.random().toString(36).slice(2, 10)}`;
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const [result] = await db.promise().query(
      `INSERT INTO users (name, email, password, phone, address, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        normalizedEmail,
        hashedPassword,
        toNullableString(phone),
        toNullableString(address),
        normalizedRole,
        toBoolean(is_active, true),
      ],
    );

    const [rows] = await db.promise().query(
      `SELECT id, name, email, phone, address, role, is_active, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
      [result.insertId],
    );

    res.status(201).json({
      message: "User created successfully",
      user: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    res.status(500).json({ error: "Error creating user" });
  }
});

// Update user profile details
router.put("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { name, email, phone, address } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const [result] = await db.promise().query(
      `UPDATE users
             SET name = ?, email = ?, phone = ?, address = ?
             WHERE id = ?`,
      [
        String(name).trim(),
        String(email).trim().toLowerCase(),
        toNullableString(phone),
        toNullableString(address),
        userId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [rows] = await db.promise().query(
      `SELECT id, name, email, phone, address, role, is_active, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
      [userId],
    );

    res.json({
      message: "User updated successfully",
      user: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    res.status(500).json({ error: "Error updating user" });
  }
});

// Activate/deactivate user
router.patch("/users/:id/status", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ error: "Cannot change your own active status" });
    }

    const nextActive = toBoolean(req.body?.is_active, true);
    const [result] = await db
      .promise()
      .query("UPDATE users SET is_active = ? WHERE id = ?", [
        nextActive,
        userId,
      ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: `User ${nextActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating user status" });
  }
});

// Update user role
router.put("/users/:id/role", async (req, res) => {
  const { role } = req.body;

  if (!["customer", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const [result] = await db
      .promise()
      .query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error updating user role" });
  }
});

// Delete user
router.delete("/users/:id", (req, res) => {
  // Prevent self-deletion
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Error deleting user" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  });
});

// Low stock alert
router.get("/inventory/low-stock", (req, res) => {
  const threshold = req.query.threshold || 10;

  const query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.stock_quantity < ?
        ORDER BY p.stock_quantity ASC
    `;

  db.query(query, [threshold], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Inventory movement history
router.get("/inventory/movements", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const productId = req.query.product_id
      ? parseInt(req.query.product_id, 10)
      : null;
    const orderId = req.query.order_id
      ? parseInt(req.query.order_id, 10)
      : null;

    const filters = [];
    const params = [];

    if (Number.isInteger(productId)) {
      filters.push("im.product_id = ?");
      params.push(productId);
    }

    if (Number.isInteger(orderId)) {
      filters.push("im.order_id = ?");
      params.push(orderId);
    }

    let query = `
            SELECT im.*, p.name AS product_name
            FROM inventory_movements im
            LEFT JOIN products p ON p.id = im.product_id
        `;

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(" AND ")}`;
    }

    query += " ORDER BY im.created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Tax rates
router.get("/tax-rates", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM tax_rates ORDER BY is_default DESC, updated_at DESC",
      );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/tax-rates", async (req, res) => {
  try {
    const {
      name,
      rate_percent,
      country = "Pakistan",
      state = null,
      is_default = false,
      is_active = true,
    } = req.body || {};

    if (!name || rate_percent === undefined || rate_percent === null) {
      return res
        .status(400)
        .json({ error: "Tax rate name and rate_percent are required" });
    }

    if (Number(is_default)) {
      await db
        .promise()
        .query("UPDATE tax_rates SET is_default = FALSE WHERE country = ?", [
          country,
        ]);
    }

    const [result] = await db.promise().query(
      `INSERT INTO tax_rates (name, rate_percent, country, state, is_default, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        Number(rate_percent),
        country,
        state,
        Boolean(is_default),
        Boolean(is_active),
      ],
    );

    const [rows] = await db
      .promise()
      .query("SELECT * FROM tax_rates WHERE id = ?", [result.insertId]);

    res.status(201).json({
      message: "Tax rate created successfully",
      taxRate: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Error creating tax rate" });
  }
});

router.put("/tax-rates/:id", async (req, res) => {
  try {
    const {
      name,
      rate_percent,
      country = "Pakistan",
      state = null,
      is_default = false,
      is_active = true,
    } = req.body || {};

    if (!name || rate_percent === undefined || rate_percent === null) {
      return res
        .status(400)
        .json({ error: "Tax rate name and rate_percent are required" });
    }

    if (Number(is_default)) {
      await db
        .promise()
        .query(
          "UPDATE tax_rates SET is_default = FALSE WHERE country = ? AND id != ?",
          [country, req.params.id],
        );
    }

    const [result] = await db.promise().query(
      `UPDATE tax_rates
             SET name = ?, rate_percent = ?, country = ?, state = ?, is_default = ?, is_active = ?
             WHERE id = ?`,
      [
        String(name).trim(),
        Number(rate_percent),
        country,
        state,
        Boolean(is_default),
        Boolean(is_active),
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT * FROM tax_rates WHERE id = ?", [req.params.id]);

    res.json({
      message: "Tax rate updated successfully",
      taxRate: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating tax rate" });
  }
});

router.delete("/tax-rates/:id", async (req, res) => {
  try {
    const taxRateId = Number(req.params.id);
    if (!Number.isInteger(taxRateId)) {
      return res.status(400).json({ error: "Invalid tax rate id" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT is_default FROM tax_rates WHERE id = ? LIMIT 1", [
        taxRateId,
      ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    if (rows[0].is_default) {
      return res.status(400).json({
        error: "Default tax rate cannot be deleted. Set another default first.",
      });
    }

    await db.promise().query("DELETE FROM tax_rates WHERE id = ?", [taxRateId]);
    res.json({ message: "Tax rate deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting tax rate" });
  }
});

// Payment methods management
router.get("/payment-methods", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT *
             FROM payment_methods
             ORDER BY sort_order ASC, created_at ASC`,
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/payment-methods", async (req, res) => {
  try {
    const {
      code,
      label,
      description,
      sort_order = 0,
      supports_online = false,
      is_active = true,
    } = req.body || {};

    const normalizedCode = String(code || "")
      .trim()
      .toLowerCase();
    const normalizedLabel = String(label || "").trim();

    if (!normalizedCode || !normalizedLabel) {
      return res
        .status(400)
        .json({ error: "Payment method code and label are required" });
    }

    if (!ALLOWED_PAYMENT_METHOD_CODES.has(normalizedCode)) {
      return res.status(400).json({
        error: "Invalid payment method code for current order schema",
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO payment_methods
             (code, label, description, sort_order, supports_online, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        normalizedCode,
        normalizedLabel,
        toNullableString(description),
        Number(sort_order) || 0,
        toBoolean(supports_online, false),
        toBoolean(is_active, true),
      ],
    );

    const [rows] = await db
      .promise()
      .query("SELECT * FROM payment_methods WHERE id = ? LIMIT 1", [
        result.insertId,
      ]);

    res.status(201).json({
      message: "Payment method created successfully",
      paymentMethod: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Payment method code already exists" });
    }

    res.status(500).json({ error: "Error creating payment method" });
  }
});

router.put("/payment-methods/:id", async (req, res) => {
  try {
    const paymentMethodId = Number(req.params.id);
    if (!Number.isInteger(paymentMethodId)) {
      return res.status(400).json({ error: "Invalid payment method id" });
    }

    const {
      code,
      label,
      description,
      sort_order = 0,
      supports_online = false,
      is_active = true,
    } = req.body || {};

    const normalizedCode = String(code || "")
      .trim()
      .toLowerCase();
    const normalizedLabel = String(label || "").trim();

    if (!normalizedCode || !normalizedLabel) {
      return res
        .status(400)
        .json({ error: "Payment method code and label are required" });
    }

    if (!ALLOWED_PAYMENT_METHOD_CODES.has(normalizedCode)) {
      return res.status(400).json({
        error: "Invalid payment method code for current order schema",
      });
    }

    const [result] = await db.promise().query(
      `UPDATE payment_methods
             SET code = ?,
                 label = ?,
                 description = ?,
                 sort_order = ?,
                 supports_online = ?,
                 is_active = ?
             WHERE id = ?`,
      [
        normalizedCode,
        normalizedLabel,
        toNullableString(description),
        Number(sort_order) || 0,
        toBoolean(supports_online, false),
        toBoolean(is_active, true),
        paymentMethodId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT * FROM payment_methods WHERE id = ? LIMIT 1", [
        paymentMethodId,
      ]);

    res.json({
      message: "Payment method updated successfully",
      paymentMethod: rows[0],
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Payment method code already exists" });
    }

    res.status(500).json({ error: "Error updating payment method" });
  }
});

router.delete("/payment-methods/:id", async (req, res) => {
  try {
    const paymentMethodId = Number(req.params.id);
    if (!Number.isInteger(paymentMethodId)) {
      return res.status(400).json({ error: "Invalid payment method id" });
    }

    const [result] = await db
      .promise()
      .query("DELETE FROM payment_methods WHERE id = ?", [paymentMethodId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting payment method" });
  }
});

// Returns management
router.get("/returns", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status ? String(req.query.status).trim() : null;

    let query = `
            SELECT rr.*, u.name AS user_name, u.email AS user_email,
                   o.total_amount, o.status AS order_status
            FROM returns_requests rr
            JOIN users u ON u.id = rr.user_id
            JOIN orders o ON o.id = rr.order_id
        `;
    const params = [];

    if (status) {
      query += " WHERE rr.status = ?";
      params.push(status);
    }

    query += " ORDER BY rr.created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

router.put("/returns/:id/status", async (req, res) => {
  const { status, note, refund_amount, method, reference_number } =
    req.body || {};
  const allowedStatuses = new Set([
    "requested",
    "approved",
    "rejected",
    "received",
    "refunded",
  ]);

  if (!allowedStatuses.has(String(status || "").trim())) {
    return res.status(400).json({ error: "Invalid return status" });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM returns_requests WHERE id = ? FOR UPDATE",
      [req.params.id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Return request not found" });
    }

    const request = rows[0];

    await connection.query(
      `UPDATE returns_requests
             SET status = ?, reviewed_by_user_id = ?, reviewed_at = NOW(), details = CONCAT(IFNULL(details, ''), ?)
             WHERE id = ?`,
      [
        status,
        req.user.id,
        note ? `\nAdmin note: ${String(note).trim()}` : "",
        req.params.id,
      ],
    );

    if (status === "refunded") {
      const refundAmount = Number(
        refund_amount || request.requested_amount || 0,
      );

      if (!(refundAmount > 0)) {
        await connection.rollback();
        return res.status(400).json({
          error: "Valid refund amount is required for refunded status",
        });
      }

      await connection.query(
        `INSERT INTO refund_transactions
                 (return_request_id, order_id, user_id, amount, method, status, reference_number, notes, processed_by_user_id, processed_at)
                 VALUES (?, ?, ?, ?, ?, 'processed', ?, ?, ?, NOW())`,
        [
          request.id,
          request.order_id,
          request.user_id,
          refundAmount,
          method || "manual",
          reference_number || null,
          note || null,
          req.user.id,
        ],
      );

      await connection.query(
        `INSERT INTO payment_transactions
                 (order_id, user_id, transaction_type, provider, amount, status, gateway_reference, payload, processed_at)
                 VALUES (?, ?, 'refund', ?, ?, 'refunded', ?, ?, NOW())`,
        [
          request.order_id,
          request.user_id,
          method || "manual",
          refundAmount,
          reference_number || null,
          JSON.stringify({ return_request_id: request.id, note: note || null }),
        ],
      );
    }

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, payload)
             VALUES (?, 'return_update', 'Return Request Updated', ?, ?)`,
      [
        request.user_id,
        `Your return request #${request.id} is now ${status}.`,
        JSON.stringify({ return_request_id: request.id, status }),
      ],
    );

    await connection.commit();
    res.json({ message: "Return request updated successfully" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: "Error updating return request" });
  } finally {
    connection.release();
  }
});

module.exports = router;

