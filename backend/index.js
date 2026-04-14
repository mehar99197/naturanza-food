const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
require("dotenv").config();
const { dbPool, db, testDatabaseConnection } = require("./config/db");
const { ensureProductionSchema } = require("./utils/schemaCompatibility");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

if (!process.env.JWT_SECRET) {
  // Development fallback so auth routes do not crash on fresh clones without a configured .env.
  process.env.JWT_SECRET = "dev_only_change_this_secret";
  console.warn("JWT_SECRET is not set. Using a development fallback secret.");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  // Google OAuth client IDs are public and safe to keep in frontend/backed dev defaults.
  process.env.GOOGLE_CLIENT_ID =
    "909610579763-59u67k55ds657snk6h7beqj8badu886r.apps.googleusercontent.com";
  console.warn(
    "GOOGLE_CLIENT_ID is not set. Using default development Google Client ID.",
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const normalizedRateLimitFlag = String(
  process.env.ENABLE_RATE_LIMITS || "",
).trim().toLowerCase();
const ENABLE_RATE_LIMITS =
  normalizedRateLimitFlag === "false"
    ? false
    : normalizedRateLimitFlag === "true" || process.env.NODE_ENV === "production";
const DEFAULT_ADMIN_EMAIL =
  process.env.DEFAULT_ADMIN_EMAIL || "meharahmad6599197@gmail.com";
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123";
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Default Admin";
const SHOULD_SEED_DEFAULT_ADMIN = process.env.SEED_DEFAULT_ADMIN !== "false";
const TRUST_PROXY_ENABLED =
  String(
    process.env.TRUST_PROXY ||
      (process.env.NODE_ENV === "production" ? "true" : "false"),
  )
    .trim()
    .toLowerCase() !== "false";

if (TRUST_PROXY_ENABLED) {
  app.set("trust proxy", true);
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
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// 2. Rate Limiting - General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// 3. Strict Rate Limiting for Authentication Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: "Too many login attempts, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// 4. Prevent parameter pollution
app.use(hpp());

// Basic Middleware
app.use(
  cors({
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Type"],
  }),
);
app.use(express.json({ limit: "10mb" })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files (images)
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);

const ensureDefaultAdminAccount = async () => {
  if (!SHOULD_SEED_DEFAULT_ADMIN) {
    return;
  }

  try {
    const [existingAdmins] = await dbPool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [DEFAULT_ADMIN_EMAIL],
    );

    if (existingAdmins.length > 0) {
      await dbPool.query("UPDATE users SET role = ? WHERE id = ?", [
        "admin",
        existingAdmins[0].id,
      ]);
      return;
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await dbPool.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, hashedPassword, "admin"],
    );

    console.log(`Default admin account ready: ${DEFAULT_ADMIN_EMAIL}`);
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

// Apply security middleware globally
app.use(sanitizeRequestBody);
app.use(sanitizeQueryParams);
app.use(preventSQLInjection);

// Routes
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const orderRoutes = require("./routes/orders");
const contactRoutes = require("./routes/contact");
const adminRoutes = require("./routes/admin");
const geolocationRoutes = require("./routes/geolocation");
const variantRoutes = require("./routes/variants");
const couponRoutes = require("./routes/coupons");
const returnsRoutes = require("./routes/returns");

// Apply rate limiting to auth routes (strict)
if (ENABLE_RATE_LIMITS) {
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/admin-login", authLimiter);

  // Apply general rate limiting to all API routes
  app.use("/api/", apiLimiter);
} else {
  console.warn(
    "Rate limiting is disabled (development mode). Set ENABLE_RATE_LIMITS=true to enable it.",
  );
}

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/geolocation", geolocationRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/returns", returnsRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Naturanza Foods API is running" });
});

app.use(notFoundHandler);
app.use(errorHandler);

let server;

const startServer = () => {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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
    startServer();
  } catch (error) {
    console.error("Error connecting to MySQL:", error.message);
    process.exit(1);
  }
};

bootstrap();

// Keep crashes diagnosable and explicit during development.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
