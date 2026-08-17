const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const hpp = require("hpp");
require("dotenv").config();
const { dbPool, db, testDatabaseConnection } = require("./config/db");
const { ensureProductionSchema } = require("./utils/schemaCompatibility");
const { getRateLimitKey } = require("./utils/rateLimitKey");
const {
  getJwtRuntimeInfo,
  getCookieDomain,
  getRefreshCookieOptions,
  getAccessCookieOptions,
} = require("./utils/jwtTokens");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const {
  csrfMiddleware,
  generateToken,
  createSignedToken,
  verifySignedToken,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_MAX_AGE,
} = require("./middleware/csrf");
const { startBlacklistCleanup } = require("./utils/tokenStore");

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn(
    "GOOGLE_CLIENT_ID is not set. Google OAuth login will be unavailable.",
  );
}

const app = express();
const PORT = process.env.PORT || 5000;
const jwtRuntime = getJwtRuntimeInfo();

// Keep framework fingerprints out of responses. Hostinger may still add its
// own edge headers, but the application must not advertise Express/Node.
app.disable("x-powered-by");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://accounts.google.com https://apis.google.com https://www.google-analytics.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "media-src 'self'",
  "frame-src 'self' https://accounts.google.com https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");
const normalizedRateLimitFlag = String(
  process.env.ENABLE_RATE_LIMITS || "",
).trim().toLowerCase();
const ENABLE_RATE_LIMITS =
  normalizedRateLimitFlag === "false"
    ? false
    : normalizedRateLimitFlag === "true" || process.env.NODE_ENV === "production";
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
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://apis.google.com",
          "https://www.googletagmanager.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://accounts.google.com",
        ],
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://apis.google.com",
          "https://www.google-analytics.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://accounts.google.com", "https://www.openstreetmap.org"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    // Google Identity Services signs the user in through a popup on
    // accounts.google.com and talks back to us through window.opener. COOP
    // "same-origin" drops the popup into a new browsing context group and
    // severs that link — the popup handle reads .closed === true immediately
    // and the credential never arrives. "same-origin-allow-popups" keeps the
    // opener link for windows WE open while still refusing to be adopted as a
    // popup by a cross-origin opener, which is the protection that matters.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    // Helmet defaults to "no-referrer", which sends no Referer to
    // accounts.google.com. GSI resolves the calling origin from that header,
    // so with it absent Google answers /gsi/button with 400 and logs "The
    // given origin is not allowed for the given client ID" — the sign-in
    // button never renders. This value leaks only the bare origin
    // (https://naturanzafood.com, no path or query) cross-origin, and nothing
    // at all when downgrading to HTTP.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

// Keep the complete policy on every production origin response.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  next();
});

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
  keyGenerator: getRateLimitKey,
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
  keyGenerator: getRateLimitKey,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

// Fetching a CSRF token is the prerequisite for every unsafe request, so
// spending the general API budget on it turns a burst of reads into "no form on
// the site can be submitted". It gets its own generous bucket instead: the
// client caches the token for the whole session, so one fetch per page load.
const csrfTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.CSRF_RATE_LIMIT_MAX || "600", 10) || 600,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req) => req.method === "OPTIONS",
});

// Password recovery is unauthenticated and sends mail to an address the caller
// names, so without its own cap it is both a reset-email flood aimed at any
// customer and a free relay against our SMTP reputation.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || "10", 10) || 10,
  message: {
    error: "Too many password reset requests. Please try again in 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req) => req.method === "OPTIONS",
});

// Public forms that put a message in someone's inbox.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number.parseInt(process.env.PUBLIC_FORM_RATE_LIMIT_MAX || "15", 10) || 15,
  message: {
    error: "Too many submissions from this IP. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req) => req.method === "OPTIONS",
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
  keyGenerator: getRateLimitKey,
  skipSuccessfulRequests: true,
});

// 4. Prevent parameter pollution
app.use(hpp());

// Basic Middleware
app.use(cookieParser());

// The edge CDN in front of this app stores API responses that carry no
// Set-Cookie header and replays them to unrelated visitors. A single 429 from
// the rate limiter was cached that way, so every browser fetching
// GET /api/csrf-token got the stored 429, never received a csrf_token cookie,
// and every form failed with "CSRF token required". API responses are
// per-request, per-session state and must never be stored by a shared cache —
// the public sitemap XML is the one exception.
const isCacheableApiPath = (reqPath) => reqPath.startsWith("/api/sitemap");

app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && !isCacheableApiPath(req.path)) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

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
      const error = new Error("Not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    }

    if (ALLOWED_CORS_ORIGINS.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    const error = new Error("Not allowed by CORS");
    error.statusCode = 403;
    return callback(error);
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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve static files (images)
// Persistent user uploads first — these live outside the git-deployed tree so
// they survive redeploys (uploaded product/category/blog/avatar images).
const {
  UPLOADS_IMAGES_DIR,
  PUBLIC_UPLOAD_FOLDERS,
  PRIVATE_UPLOAD_FOLDERS,
} = require("./middleware/upload");

// Payment screenshots contain private customer and transaction data. They are
// served only through the authenticated admin endpoint, never as static files.
//
// Mounting a deny-handler on "/images/payment-verifications" was NOT enough:
// Express matches a mount path against decoded path *segments*, so "%2f" and a
// doubled slash never matched the prefix, while express.static's own
// normalisation still resolved the file — "/images/payment-verifications%2fx.webp"
// returned the screenshot unauthenticated. The path is now decoded first and
// every segment is checked.
const requestsPrivateUpload = (rawPath) => {
  let decoded = String(rawPath || "");
  // Decode repeatedly so a double-encoded separator cannot hide the segment.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      break;
    }
    if (next === decoded) break;
    decoded = next;
  }

  return decoded
    .replace(/\\/g, "/")
    .toLowerCase()
    .split("/")
    .some((segment) => PRIVATE_UPLOAD_FOLDERS.has(segment));
};

app.use("/images", (req, res, next) => {
  if (requestsPrivateUpload(req.path)) {
    return res.status(404).end();
  }
  next();
});

// Second line of defence: give each public upload folder its own static root so
// the private folder is not inside any static root at all, whatever the URL
// looks like. A traversal out of one of these roots is rejected by `send`.
for (const folder of PUBLIC_UPLOAD_FOLDERS) {
  app.use(
    `/images/${folder}`,
    express.static(path.join(UPLOADS_IMAGES_DIR, folder)),
  );
}
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "frontend", "public", "images")),
);
// Uploaded media may be lost when a Hostinger deployment replaces a
// non-persistent upload directory. Keep stale database URLs harmless by
// returning a bundled, public placeholder instead of a JSON 404 response.
// Payment verification files are handled by the deny-only middleware above and
// must never fall through to this public fallback.
app.use("/images", (req, res, next) => {
  const requestedPath = String(req.path || "");
  const extension = path.extname(requestedPath).toLowerCase();
  if (!extension || ![".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)) {
    return next();
  }

  let fallbackRelativePath = null;
  if (requestedPath.startsWith("/products/")) {
    fallbackRelativePath = "products/honey.webp";
  } else if (requestedPath.startsWith("/categories/")) {
    fallbackRelativePath = "og-image.jpg";
  } else if (requestedPath.startsWith("/blog/")) {
    fallbackRelativePath = "og-image.jpg";
  }

  if (!fallbackRelativePath) {
    return next();
  }

  return res.sendFile(
    path.join(__dirname, "..", "frontend", "public", "images", fallbackRelativePath),
    { maxAge: "1h" },
    (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    },
  );
});
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

      // Never turn an existing customer, staff admin, or disabled account into
      // a super-admin during a normal application restart. Bootstrapping must be
      // additive only; privilege changes belong to an explicit admin workflow.
      if (roleValue !== "admin" || adminRoleValue !== "super_admin" || !existingUser.is_active) {
        console.warn(
          `Default admin seed skipped for existing account ${DEFAULT_ADMIN_EMAIL}: ` +
            "the account is not already an active super-admin.",
        );
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

// The overselling defence in utils/stockReservations.js rests entirely on
// transactions and SELECT ... FOR UPDATE, and the schema declares foreign keys
// throughout — all of which MyISAM accepts and silently ignores. schema/database.sql
// now pins ENGINE=InnoDB, but an existing deployment created before that could
// have drifted, and the failure mode is invisible: no error, just locks that
// never lock. Warn loudly rather than block boot, since a running store must not
// be taken down by a diagnostic.
const warnOnNonInnoDbTables = async () => {
  try {
    const [rows] = await dbPool.query(
      `SELECT TABLE_NAME, ENGINE
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
          AND (ENGINE IS NULL OR ENGINE <> 'InnoDB')`,
    );

    if (rows.length > 0) {
      const names = rows.map((row) => `${row.TABLE_NAME} (${row.ENGINE || "unknown"})`);
      console.warn(
        `WARNING: ${rows.length} table(s) are not InnoDB: ${names.join(", ")}. ` +
          "Transactions, row locks and foreign keys do NOT work on these — stock " +
          "reservations can oversell. Convert with: ALTER TABLE <name> ENGINE=InnoDB;",
      );
    }
  } catch (error) {
    console.warn("Could not verify table storage engines:", error.message);
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
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
  await warnOnNonInnoDbTables();
  await ensureDefaultAdminAccount();
};

// Keep legacy routes operational while migrating from implicit global DB access.
global.db = db;
app.locals.db = db;

// Security Middleware
const {
  sanitizeRequestBody,
  sanitizeQueryParams,
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

// Apply CSRF protection (skip in development if explicitly disabled)
const csrfEnabled = String(process.env.ENABLE_CSRF_PROTECTION || "true").toLowerCase();
if (csrfEnabled !== "false" && process.env.NODE_ENV !== "development") {
  // No exclusions: every path previously listed here is GET-only, and GETs are
  // already skipped inside the middleware. The list therefore only exempted the
  // unsafe methods on those prefixes — POST /api/products and POST
  // /api/categories were running with no CSRF check at all.
  app.use(csrfMiddleware());
}

// Routes
const legacyAuthRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const blogRoutes = require("./routes/blog");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const orderRoutes = require("./routes/orders");
const contactRoutes = require("./routes/contact");
const settingsRoutes = require("./routes/settings");
const aboutRoutes = require("./routes/about");
const adminRoutes = require("./routes/admin");
const adminSecurityRoutes = require("./routes/adminSecurity");
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
  app.use("/api/auth/verify-email", authLimiter);
  app.use("/api/auth/resend-verification", authLimiter);
  app.use("/api/auth/refresh", refreshLimiter);
  app.use("/api/auth/refresh-token", refreshLimiter);
  app.use("/api/admin/login", authLimiter);
  // The staff gate is a login endpoint too — it sat at the general 2000/15min
  // budget, which is a password-spraying window across every staff account.
  app.use("/api/admin/staff-login", authLimiter);
  // 2FA verify/enable/disable endpoints are credential-adjacent — same strict bucket.
  app.use("/api/admin/security/2fa", authLimiter);

  app.use("/api/auth/forgot-password", passwordResetLimiter);
  app.use("/api/auth/reset-password", passwordResetLimiter);
  app.use("/api/admin/forgot-password", passwordResetLimiter);
  app.use("/api/admin/reset-password", passwordResetLimiter);

  // POST only: the same prefix carries the admin Messages screen (GET/PUT/
  // DELETE), which an admin working through the inbox would blow past.
  app.use("/api/contact", (req, res, next) =>
    req.method === "POST" ? publicFormLimiter(req, res, next) : next(),
  );

  app.use("/api/csrf-token", csrfTokenLimiter);

  // Apply general rate limiting to all API routes (except auth and the CSRF
  // token endpoint, which have their own limits, and the health check used by
  // uptime monitors)
  app.use("/api/", (req, res, next) => {
    const authPath = req.path.match(/^\/auth\/(login|register|google|refresh)/);
    const hasOwnLimiter = req.path === "/csrf-token" || req.path === "/health";
    if (!authPath && !hasOwnLimiter) {
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
// The legacy router is the active auth implementation. The modular auth stack
// is not mounted because it uses a different token/schema contract.
app.use("/api/auth", legacyAuthRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/payments", paymentRoutes);
// Mounted before /api/admin so the security router always wins its own prefix.
app.use("/api/admin/security", adminSecurityRoutes);
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
// Canonical sitemap at the well-known root path (not under /api) so
// robots.txt's "Sitemap: https://naturanzafood.com/sitemap.xml" and Google
// Search Console's sitemap submission resolve directly to it. Registered
// before the production static/SPA-fallback block below so it always wins
// over the pre-built frontend/dist/sitemap.xml.
app.get("/sitemap.xml", sitemapRoutes.fullSitemapHandler);
app.use("/api/admin/shipping", adminShippingRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// CSRF token endpoint for frontend
app.get("/api/csrf-token", (req, res) => {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  const cookieDomain = getCookieDomain(req);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: "/",
  };

  if (existingToken) {
    const verification = verifySignedToken(existingToken);
    if (verification.valid) {
      if (cookieDomain) {
        // Migrate an older host-only cookie so apex and www remain consistent.
        res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
        res.cookie(CSRF_COOKIE_NAME, existingToken, {
          ...cookieOptions,
          domain: cookieDomain,
        });
      }
      return res.json({ csrfToken: existingToken });
    }
  }

  const rawToken = req.csrfToken || generateToken();
  const signedToken = createSignedToken(rawToken);

  res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
  if (cookieDomain) {
    res.clearCookie(CSRF_COOKIE_NAME, { ...cookieOptions, domain: cookieDomain, maxAge: 0 });
  }
  res.cookie(CSRF_COOKIE_NAME, signedToken, {
    ...cookieOptions,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
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
      const cookieDomain = getCookieDomain(req);
      if (cookieDomain) {
        const refreshToken = req.cookies?.[jwtRuntime.refreshCookieName];
        if (refreshToken) {
          res.cookie(
            jwtRuntime.refreshCookieName,
            refreshToken,
            getRefreshCookieOptions(req),
          );
        }

        const adminAccessToken = req.cookies?.adminAccessToken;
        if (adminAccessToken) {
          res.cookie("adminAccessToken", adminAccessToken, getAccessCookieOptions(req));
        }

        const csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
        if (csrfToken) {
          res.cookie(CSRF_COOKIE_NAME, csrfToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: CSRF_COOKIE_MAX_AGE,
            path: "/",
            domain: cookieDomain,
          });
        }
      }
      return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
    }
    next();
  });
}

// Next.js owns the routes listed in nextRoutes.js and nothing else; every other
// path falls through to the Vite build below exactly as before.
//
// Position is load-bearing in both directions: below the www -> apex redirect,
// so a migrated page cannot answer on the non-canonical host, and above
// express.static, so a migrated page is never shadowed by a stale file of the
// same name left in dist/ by an earlier build.
//
// The flag is separate from NODE_ENV so the composition can be exercised locally
// without also switching on production-only schema enforcement.
const NEXT_ENABLED =
  String(
    process.env.ENABLE_NEXT ||
      (process.env.NODE_ENV === "production" ? "true" : "false"),
  )
    .trim()
    .toLowerCase() !== "false";

if (NEXT_ENABLED) {
  const { createNextMiddleware } = require("./nextServer");
  const { isNextRoute } = require("./nextRoutes");
  app.use(createNextMiddleware({ dbPool, isNextRoute }));
}

if (process.env.NODE_ENV === "production") {
  // index:false is load-bearing. With the default, express.static answers "/"
  // with dist/index.html directly and the SEO renderer below never runs for the
  // homepage — it shipped the raw shell: an empty body, the template's homepage
  // canonical, and none of the crawlable product links. Every other route
  // already fell through because no file matches them. Requests for the literal
  // /index.html still resolve here as a normal static file.
  app.use(express.static(frontendDist, { index: false }));

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

    startBlacklistCleanup(dbPool, 60 * 60_000);
    console.log("Token blacklist cleanup running (hourly interval).");
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
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});
