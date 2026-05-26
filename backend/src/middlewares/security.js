const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const corsOrigins = new Set(
  (Array.isArray(env.CORS_ORIGINS) ? env.CORS_ORIGINS : [])
    .map((origin) => String(origin || "").trim().replace(/\/$/, ""))
    .filter(Boolean),
);

const buildLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
  });

const authLimiter = buildLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
});

const refreshLimiter = buildLimiter({
  windowMs: env.REFRESH_RATE_LIMIT_WINDOW_MS,
  max: env.REFRESH_RATE_LIMIT_MAX,
  message: "Too many token refresh attempts, please try again later.",
  skipSuccessfulRequests: true,
});

const globalLimiter = buildLimiter({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  message: "Too many requests from this IP, please try again later.",
  skipSuccessfulRequests: false,
});

const applySecurityMiddlewares = (app) => {
  if (!app || typeof app.use !== "function") {
    throw new Error("applySecurityMiddlewares requires an Express app instance");
  }

  if (env.TRUST_PROXY) {
    app.set("trust proxy", true);
  }

  if (env.ENFORCE_HTTPS && env.IS_PRODUCTION) {
    app.use((req, res, next) => {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
        .trim()
        .toLowerCase();

      if (req.secure || forwardedProto === "https") {
        return next();
      }

      return res.status(400).json({ error: "HTTPS is required" });
    });
  }

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(hpp());
  app.use(cookieParser());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = String(origin).trim().replace(/\/$/, "");
        if (corsOrigins.has(normalizedOrigin)) {
          return callback(null, true);
        }

        const corsError = new Error("CORS origin denied");
        corsError.statusCode = 403;
        return callback(corsError);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  if (env.ENABLE_RATE_LIMITS) {
    app.use("/api/auth/register", authLimiter);
    app.use("/api/auth/login", authLimiter);
    app.use("/api/auth/refresh-token", refreshLimiter);
    app.use("/api", globalLimiter);
  }
};

module.exports = {
  authLimiter,
  refreshLimiter,
  globalLimiter,
  applySecurityMiddlewares,
};
