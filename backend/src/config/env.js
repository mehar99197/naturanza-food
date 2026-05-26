const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const TTL_REGEX = /^\d+\s*[dhms]$/i;

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", ""].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const intFromEnv = ({ min, max, defaultValue }) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      return undefined;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) {
      return value;
    }

    return parsed;
  }, z.number().int().min(min).max(max).default(defaultValue));

const commaSeparatedFromEnv = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}, z.array(z.string()).default([]));

const optionalString = () =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
  }, z.string().optional());

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/, "");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: intFromEnv({ min: 1, max: 65535, defaultValue: 5000 }),

  TRUST_PROXY: booleanFromEnv.default(false),
  ENFORCE_HTTPS: booleanFromEnv.default(false),

  ENABLE_RATE_LIMITS: booleanFromEnv.default(false),
  AUTH_RATE_LIMIT_WINDOW_MS: intFromEnv({
    min: 1000,
    max: 24 * 60 * 60 * 1000,
    defaultValue: 15 * 60 * 1000,
  }),
  AUTH_RATE_LIMIT_MAX: intFromEnv({ min: 1, max: 5000, defaultValue: 5 }),
  REFRESH_RATE_LIMIT_WINDOW_MS: intFromEnv({
    min: 1000,
    max: 24 * 60 * 60 * 1000,
    defaultValue: 15 * 60 * 1000,
  }),
  REFRESH_RATE_LIMIT_MAX: intFromEnv({ min: 1, max: 5000, defaultValue: 25 }),
  GLOBAL_RATE_LIMIT_WINDOW_MS: intFromEnv({
    min: 1000,
    max: 24 * 60 * 60 * 1000,
    defaultValue: 15 * 60 * 1000,
  }),
  GLOBAL_RATE_LIMIT_MAX: intFromEnv({ min: 1, max: 100000, defaultValue: 100 }),

  FRONTEND_URL: z.string().trim().default("http://localhost:5173"),
  CLIENT_URL: z.string().trim().default("http://localhost:5173"),
  CORS_ALLOWED_ORIGINS: commaSeparatedFromEnv,

  JWT_ISSUER: z.string().trim().min(1).default("naturanza-api"),
  JWT_AUDIENCE: z.string().trim().min(1).default("naturanza-client"),
  ACCESS_TOKEN_TTL: z
    .string()
    .trim()
    .regex(TTL_REGEX, "ACCESS_TOKEN_TTL must look like 15m or 1h")
    .default("15m"),
  COOKIE_SECURE: booleanFromEnv.default(false),
  COOKIE_DOMAIN: z.string().trim().default(""),
  REFRESH_COOKIE_NAME: z.string().trim().min(1).default("refreshToken"),
  REFRESH_TOKEN_TTL: z
    .string()
    .trim()
    .regex(TTL_REGEX, "REFRESH_TOKEN_TTL must look like 7d, 24h, or 30m")
    .default("7d"),
  JWT_ACCESS_SECRET: optionalString(),
  JWT_REFRESH_SECRET: optionalString(),
  JWT_SECRET: optionalString(),
  JWT_ACCESS_PRIVATE_KEY: optionalString(),
  JWT_ACCESS_PUBLIC_KEY: optionalString(),
  JWT_REFRESH_PRIVATE_KEY: optionalString(),
  JWT_REFRESH_PUBLIC_KEY: optionalString(),

  BCRYPT_ROUNDS: intFromEnv({ min: 10, max: 16, defaultValue: 12 }),
  LOGIN_MAX_ATTEMPTS: intFromEnv({ min: 3, max: 20, defaultValue: 5 }),
  LOGIN_LOCK_MINUTES: intFromEnv({ min: 5, max: 1440, defaultValue: 15 }),

  DB_HOST: z.string().trim().default("localhost"),
  DB_PORT: intFromEnv({ min: 1, max: 65535, defaultValue: 3306 }),
  DB_USER: z.string().trim().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().trim().default("naturanza"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => (issue.path.join(".") || "env") + ": " + issue.message)
    .join("; ");

  throw new Error("Invalid environment configuration: " + details);
}

const env = {
  ...parsed.data,
  IS_PRODUCTION: parsed.data.NODE_ENV === "production",
  CORS_ORIGINS: [
    parsed.data.FRONTEND_URL,
    parsed.data.CLIENT_URL,
    ...parsed.data.CORS_ALLOWED_ORIGINS,
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
};

module.exports = {
  EnvSchema,
  env,
};
