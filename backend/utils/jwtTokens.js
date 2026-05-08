const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_MINUTES = Math.max(
  Number.parseInt(process.env.ACCESS_TOKEN_MINUTES || "15", 10) || 15,
  5,
);
const REFRESH_TOKEN_DAYS = Math.max(
  Number.parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10) || 7,
  1,
);
const JWT_ISSUER = String(process.env.JWT_ISSUER || "naturanza-foods-api").trim();
const JWT_AUDIENCE = String(process.env.JWT_AUDIENCE || "naturanza-foods-web").trim();
const REFRESH_COOKIE_NAME =
  String(process.env.REFRESH_COOKIE_NAME || "refreshToken").trim() ||
  "refreshToken";

const normalizePem = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(/\\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
};

const JWT_PRIVATE_KEY = normalizePem(process.env.JWT_PRIVATE_KEY);
const JWT_PUBLIC_KEY = normalizePem(process.env.JWT_PUBLIC_KEY);
const RAW_JWT_SECRET = String(
  process.env.JWT_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    "",
).trim();
const NODE_ENV = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";

const resolveHsSecret = () => {
  const secretLengthBytes = Buffer.byteLength(RAW_JWT_SECRET, "utf8");
  if (secretLengthBytes >= 64) {
    return RAW_JWT_SECRET;
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "JWT_SECRET must be at least 64 bytes (512 bits) when RS256 keys are not configured.",
    );
  }

  // Development fallback: derive a high-entropy secret from configured value.
  const seed = RAW_JWT_SECRET || `${process.cwd()}::naturanza-dev-jwt-secret`;
  const derived = crypto.createHash("sha512").update(seed, "utf8").digest("hex");

  console.warn(
    "JWT_SECRET is shorter than 64 bytes; using a derived development secret. Configure JWT_SECRET >= 64 bytes for production.",
  );

  return derived;
};

const hasRsaKeys = Boolean(JWT_PRIVATE_KEY && JWT_PUBLIC_KEY);
const signingAlgorithm = hasRsaKeys ? "RS256" : "HS256";
const allowedAlgorithms = [signingAlgorithm];
const HS_SECRET = hasRsaKeys ? null : resolveHsSecret();

const jwtSigningKey = hasRsaKeys ? JWT_PRIVATE_KEY : HS_SECRET;
const jwtVerificationKey = hasRsaKeys ? JWT_PUBLIC_KEY : HS_SECRET;

const tokenTypeSchema = new Set(["access", "refresh"]);

const buildTokenPayload = (user, tokenType) => {
  if (!tokenTypeSchema.has(tokenType)) {
    throw new Error("Invalid token type");
  }

  return {
    sub: String(user.id),
    email: String(user.email || "").trim().toLowerCase(),
    role: String(user.role || "customer").trim().toLowerCase(),
    type: tokenType,
    jti: crypto.randomUUID(),
  };
};

const signToken = (payload, expiresIn) => {
  return jwt.sign(payload, jwtSigningKey, {
    algorithm: signingAlgorithm,
    expiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    notBefore: "0s",
  });
};

const issueAccessToken = (user) => {
  const payload = buildTokenPayload(user, "access");
  const token = signToken(payload, `${ACCESS_TOKEN_MINUTES}m`);

  return {
    token,
    jti: payload.jti,
    expiresInSeconds: ACCESS_TOKEN_MINUTES * 60,
  };
};

const issueRefreshToken = (user) => {
  const payload = buildTokenPayload(user, "refresh");
  const token = signToken(payload, `${REFRESH_TOKEN_DAYS}d`);

  return {
    token,
    jti: payload.jti,
    expiresInSeconds: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  };
};

const verifyToken = (token, expectedType) => {
  const payload = jwt.verify(token, jwtVerificationKey, {
    algorithms: allowedAlgorithms,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    clockTolerance: 5,
  });

  if (expectedType && payload?.type !== expectedType) {
    throw new Error("JWT token type mismatch");
  }

  return payload;
};

const verifyAccessToken = (token) => verifyToken(token, "access");
const verifyRefreshToken = (token) => verifyToken(token, "refresh");

const toExpiryDate = (payload) => {
  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) {
    return null;
  }

  return new Date(exp * 1000);
};

const shouldUseSecureCookies = () => {
  const explicitFlag = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();

  if (explicitFlag === "true") {
    return true;
  }

  if (explicitFlag === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: shouldUseSecureCookies(),
  sameSite: "strict",
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: "/api/auth",
});

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });
};

const getJwtRuntimeInfo = () => ({
  signingAlgorithm,
  allowedAlgorithms,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  accessTokenMinutes: ACCESS_TOKEN_MINUTES,
  refreshTokenDays: REFRESH_TOKEN_DAYS,
  refreshCookieName: REFRESH_COOKIE_NAME,
});

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  toExpiryDate,
  getRefreshCookieOptions,
  clearRefreshCookie,
  getJwtRuntimeInfo,
};
