const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const hpp = require("hpp");
require("dotenv").config();
const { dbPool, db, testDatabaseConnection } = require("./config/db");
const { ensureProductionSchema } = require("./utils/schemaCompatibility");
const { getJwtRuntimeInfo } = require("./utils/jwtTokens");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const {
  csrfMiddleware,
  generateToken,
  createSignedToken,
  verifySignedToken,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_MAX_AGE,
} = require("./middleware/csrf");

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn(
    "GOOGLE_CLIENT_ID is not set. Google OAuth login will be unavailable.",
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const jwtRuntime = getJwtRuntimeInfo();
const normalizedRateLimitFlag = String(
  process.env.ENABLE_RATE_LIMITS || "",
).trim().toLowerCase();
const ENABLE_RATE_LIMITS =
  normalizedRateLimitFlag === "false"
    ? false
    : normalizedRateLimitFlag === "true" || process.env.NODE_ENV === "production" || true;
const DEFAULT_ADMIN_EMAIL =
  String(process.env.DEFAULT_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
const DEFAULT_ADMIN_PASSWORD =
  String(process.env.DEFAULT_ADMIN_PASSWORD || "");
const DEFAULT_ADMIN_NAME =
  String(process.env.DEFAULT_ADMIN_NAME || "Default Admin").trim() ||
  "Default Admin";
const SHOULD_SEED_DEFAULT_ADMIN =
  String(process.env.SEED_DEFAULT_ADMIN || "")
    .trim()
    .toLowerCase() === "true";
const TRUST_PROXY_ENABLED =
  String(
    process.env.TRUST_PROXY ||
      (process.env.NODE_ENV === "production" ? "true" : "false"),
  )
    .trim()
    .toLowerCase() !== "false";
const ALLOWED_CORS_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ENFORCE_HTTPS =
  String(process.env.ENFORCE_HTTPS || "")
    .trim()
    .toLowerCase() === "true";

if (TRUST_PROXY_ENABLED) {
  app.set("trust proxy", 1);
}

if (ENFORCE_HTTPS && process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
      .trim()
      .toLowerCase();
    if (req.secure || forwardedProto === "https") {
      return next();
    }

    // Redirect HTTP → HTTPS with a permanent redirect
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

// Security Middleware - Apply BEFORE other middleware
// 1. Helmet - Set security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://accounts.google.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// 2. Rate Limiting - General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // A logged-in user browsing the SPA legitimately makes many calls per 15 min
  // (per-page reads + background polling). 500 was too low and tripped normal
  // sessions. Auth/brute-force is still tightly capped by authLimiter below.
  max: Number.parseInt(process.env.API_RATE_LIMIT_MAX || "2000", 10) || 2000,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't spend the budget on CORS preflight requests.
  skip: (req) => req.method === "OPTIONS",
});

// 3. Strict Rate Limiting for Authentication Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many login attempts, please try again after 15 minutes",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  skipSuccessfulRequests: true,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    error: "Too many refresh attempts, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// 4. Prevent parameter pollution
app.use(hpp());

// Basic Middleware
app.use(cookieParser());

// CORS Configuration - Restrict origins in production
const DEV_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = String(origin).replace(/\/$/, "");

    if (process.env.NODE_ENV !== "production") {
      if (DEV_CORS_ORIGINS.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }

    if (ALLOWED_CORS_ORIGINS.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Skip-Auth-Refresh",
    "x-csrf-token",
    "X-CSRF-Token",
  ],
  exposedHeaders: ["Content-Disposition", "Content-Type", "Content-Length"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files (images)
// Persistent user uploads first — these live outside the git-deployed tree so
// they survive redeploys (payment screenshots, uploaded product/category images).
const { UPLOADS_IMAGES_DIR } = require("./middleware/upload");
app.use("/images", express.static(UPLOADS_IMAGES_DIR));
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "frontend", "public", "images")),
);
// Serve uploaded files (admin profile pictures, etc.)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads")),
);

const ensureDefaultAdminAccount = async () => {
  if (!SHOULD_SEED_DEFAULT_ADMIN) {
    return;
  }

  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    console.warn(
      "SEED_DEFAULT_ADMIN=true but DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD is missing. Skipping default admin seed.",
    );
    return;
  }

  if (DEFAULT_ADMIN_PASSWORD.length < 12) {
    console.warn(
      "DEFAULT_ADMIN_PASSWORD must be at least 12 characters. Skipping default admin seed.",
    );
    return;
  }

  try {
    const [existingUsers] = await dbPool.query(
      "SELECT id, role, admin_role, is_active FROM users WHERE email = ? LIMIT 1",
      [DEFAULT_ADMIN_EMAIL],
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const roleValue = String(existingUser.role || "").trim().toLowerCase();
      const adminRoleValue = String(existingUser.admin_role || "")
        .trim()
        .toLowerCase();
      const needsRoleUpdate = roleValue !== "admin";
      const needsAdminRoleUpdate = adminRoleValue !== "super_admin";
      const needsActivation = !existingUser.is_active;

      if (needsRoleUpdate || needsAdminRoleUpdate || needsActivation) {
        await dbPool.query(
          "UPDATE users SET role = 'admin', admin_role = 'super_admin', is_active = TRUE WHERE id = ?",
          [existingUser.id],
        );
        console.log(`Default admin account updated: ${DEFAULT_ADMIN_EMAIL}`);
      }
    } else {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
      await dbPool.query(
        "INSERT INTO users (name, email, password, role, admin_role, is_active) VALUES (?, ?, ?, 'admin', 'super_admin', TRUE)",
        [DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, hashedPassword],
      );

      console.log(`Default admin account created: ${DEFAULT_ADMIN_EMAIL}`);
    }

    // NOTE: previously this block demoted every non-default admin to customer
    // on each startup. That silently destroyed any staff_admin accounts created
    // through the Admin Management UI on every nodemon reload. Staff admin
    // lifecycle is now owned by /api/admin-management/admins — startup must
    // not touch existing admin rows beyond the default-admin upsert above.
  } catch (error) {
    console.warn("Could not ensure default admin account:", error.message);
  }
};

const ensureDatabaseCompatibility = async () => {
  try {
    await ensureProductionSchema(dbPool);
  } catch (error) {
    console.warn(
      "Could not ensure production schema compatibility:",
      error.message,
    );
  }
  await ensureDefaultAdminAccount();
};

// Keep legacy routes operational while migrating from implicit global DB access.
global.db = db;
app.locals.db = db;

// Security Middleware
const {
  sanitizeRequestBody,
  sanitizeQueryParams,
  preventSQLInjection,
} = require("./middleware/security");
const { ensurePasswordHistoryTable } = require("./utils/passwordHistory");

// Initialize password history table on startup
const initPasswordHistory = async () => {
  try {
    const connection = await dbPool.getConnection();
    try {
      await ensurePasswordHistoryTable(connection);
      console.log("Password history table initialized");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.warn("Could not initialize password history table:", error.message);
  }
};

// Apply security middleware globally
app.use(sanitizeRequestBody);
app.use(sanitizeQueryParams);
app.use(preventSQLInjection);

// Apply CSRF protection (skip in development if explicitly disabled)
const csrfEnabled = String(process.env.ENABLE_CSRF_PROTECTION || "true").toLowerCase();
if (csrfEnabled !== "false" && process.env.NODE_ENV !== "development") {
  app.use(csrfMiddleware({
    excludePaths: [
      "/api/health",
      "/api/products",           // GET requests only
      "/api/categories",         // GET requests only
      "/api/geolocation",
      "/api/announcements/active",
    ],
  }));
}

// Routes
const { authRouter } = require("./src/modules/auth/auth.routes");
const legacyAuthRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const orderRoutes = require("./routes/orders");
const contactRoutes = require("./routes/contact");
const settingsRoutes = require("./routes/settings");
const adminRoutes = require("./routes/admin");
const adminManagementRoutes = require("./routes/adminManagement");
const adminPaymentsRoutes = require("./routes/adminPayments");
const paymentRoutes = require("./routes/payments");
const geolocationRoutes = require("./routes/geolocation");
const variantRoutes = require("./routes/variants");
const couponRoutes = require("./routes/coupons");
const returnsRoutes = require("./routes/returns");
const reviewsRoutes = require("./routes/reviews");
const announcementsRoutes = require("./routes/announcements");
const teamRoutes = require("./routes/team");
const newsletterRoutes = require("./routes/newsletter");
const sitemapRoutes = require("./routes/sitemap");
const shippingRoutes = require("./routes/shipping");
const adminShippingRoutes = require("./routes/adminShipping");

// Apply rate limiting to auth routes (strict)
if (ENABLE_RATE_LIMITS) {
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/google", authLimiter);
  app.use("/api/auth/refresh", refreshLimiter);
  app.use("/api/auth/refresh-token", refreshLimiter);
  app.use("/api/admin/login", authLimiter);

  // Apply general rate limiting to all API routes (except auth which has its own limits)
  app.use("/api/", (req, res, next) => {
    const authPath = req.path.match(/^\/auth\/(login|register|google|refresh)/);
    if (!authPath) {
      apiLimiter(req, res, next);
    } else {
      next();
    }
  });
} else {
  console.warn(
    "Rate limiting is disabled (development mode). Set ENABLE_RATE_LIMITS=true to enable it.",
  );
}

// Mount routes
// Keep legacy auth endpoints first so overlapping auth flows remain consistent.
app.use("/api/auth", legacyAuthRoutes);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/payments", adminPaymentsRoutes);
app.use("/api/admin-management", adminManagementRoutes);
app.use("/api/geolocation", geolocationRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api", sitemapRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/admin/shipping", adminShippingRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// CSRF token endpoint for frontend
app.get("/api/csrf-token", (req, res) => {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (existingToken) {
    const verification = verifySignedToken(existingToken);
    if (verification.valid) {
      return res.json({ csrfToken: existingToken });
    }
  }

  const rawToken = req.csrfToken || generateToken();
  const signedToken = createSignedToken(rawToken);

  res.cookie(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: "/",
  });

  return res.json({ csrfToken: signedToken });
});

// Serve React frontend in production
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
if (process.env.NODE_ENV === "production") {
  // Canonical host: 301 www -> apex so the two don't compete as duplicate content.
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (host.startsWith("www.")) {
      return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
    }
    next();
  });

  app.use(express.static(frontendDist));

  const { renderPage } = require("./utils/seoRenderer");
  const ASSET_EXTENSION = /\.[a-zA-Z0-9]{1,8}$/;

  // SPA fallback with per-route SEO meta injection + correct HTTP status.
  app.use(async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }
    if (req.path.startsWith("/api/") || req.path.startsWith("/images/") || req.path.startsWith("/uploads/")) {
      return next();
    }
    // A static asset that wasn't matched by express.static above doesn't exist —
    // return a real 404 instead of serving the SPA shell for a missing file.
    if (ASSET_EXTENSION.test(req.path)) {
      return res.status(404).type("txt").send("Not Found");
    }
    try {
      const { status, html } = await renderPage(req.path, frontendDist);
      return res.status(status).type("html").send(html);
    } catch (renderError) {
      // Never let meta rendering break navigation — fall back to the raw shell.
      return res.sendFile(path.join(frontendDist, "index.html"));
    }
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

let server;

const { startReservationSweeper } = require("./utils/stockReservations");

const startServer = () => {
  server = app.listen(PORT, () => {
    console.log(
      `JWT configured with ${jwtRuntime.signingAlgorithm} (allowed: ${jwtRuntime.allowedAlgorithms.join(", ")}).`,
    );
    console.log(`Server is running on port ${PORT}`);

    // Release expired stock reservations every 5 minutes. The sweeper guards
    // against orphan reservations (customer abandons screenshot upload, admin
    // never reaches the queue) permanently blocking inventory.
    startReservationSweeper({ intervalMs: 5 * 60_000 });
    console.log("Stock reservation sweeper running (5-minute interval).");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the previous backend process and restart.`,
      );
    } else {
      console.error("Server error:", err);
    }
  });
};

const bootstrap = async () => {
  try {
    const connectionInfo = await testDatabaseConnection();
    console.log(
      `Connected to MySQL ${connectionInfo.mysqlVersion} (database: ${connectionInfo.databaseName})`,
    );
    await ensureDatabaseCompatibility();
    await initPasswordHistory();
    startServer();
  } catch (error) {
    const details = [error.code, error.errno, error.sqlMessage, error.message]
      .filter(Boolean)
      .join(" | ");
    console.error("Error connecting to MySQL:", details || error);
    if (error.code === "ECONNREFUSED") {
      console.error(
        "Hint: the MySQL/MariaDB server is not reachable. Start it with: sudo systemctl start mariadb",
      );
    }
    process.exit(1);
  }
};

bootstrap();

// Keep crashes diagnosable and explicit during development.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  // Exit in production so the process manager (e.g. PM2) can restart cleanly.
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
