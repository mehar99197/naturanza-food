const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const normalizePem = (value) => {
  const normalized = String(value || "").replace(/\\n/g, "\n").trim();
  return normalized || null;
};

const ensureUserId = (userId) => {
  const normalized = Number.parseInt(String(userId || ""), 10);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Invalid user id for JWT payload");
  }

  return normalized;
};

const resolveSignerConfig = (tokenType) => {
  const isAccess = tokenType === "access";

  const privateKey = normalizePem(
    isAccess ? env.JWT_ACCESS_PRIVATE_KEY : env.JWT_REFRESH_PRIVATE_KEY,
  );
  const publicKey = normalizePem(
    isAccess ? env.JWT_ACCESS_PUBLIC_KEY : env.JWT_REFRESH_PUBLIC_KEY,
  );

  if (privateKey && publicKey) {
    return {
      algorithm: "RS256",
      signingKey: privateKey,
      verificationKey: publicKey,
      allowedAlgorithms: ["RS256"],
    };
  }

  const fallbackSecret = String(
    (isAccess ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET) ||
      env.JWT_SECRET ||
      process.env.JWT_SECRET ||
      "",
  ).trim();

  if (Buffer.byteLength(fallbackSecret, "utf8") < 32) {
    throw new Error(
      "JWT secret must be at least 32 bytes when RSA keys are not configured",
    );
  }

  return {
    algorithm: "HS256",
    signingKey: fallbackSecret,
    verificationKey: fallbackSecret,
    allowedAlgorithms: ["HS256"],
  };
};

const ACCESS_SIGNER = resolveSignerConfig("access");
const REFRESH_SIGNER = resolveSignerConfig("refresh");

const createToken = ({
  tokenType,
  signer,
  userId,
  role,
  sessionId,
  familyId,
  parentJti,
  extraClaims,
  expiresIn,
}) => {
  const jti = crypto.randomUUID();
  const safeUserId = ensureUserId(userId);

  if (!sessionId) {
    throw new Error("sessionId is required for token issuance");
  }

  const payload = {
    sub: String(safeUserId),
    role: String(role || "customer").trim().toLowerCase(),
    type: tokenType,
    jti,
    sessionId: String(sessionId),
    ...(familyId ? { familyId: String(familyId) } : {}),
    ...(parentJti ? { parentJti: String(parentJti) } : {}),
    ...(extraClaims && typeof extraClaims === "object" ? extraClaims : {}),
  };

  const token = jwt.sign(payload, signer.signingKey, {
    algorithm: signer.algorithm,
    expiresIn,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    notBefore: "0s",
  });

  return { token, jti };
};

const normalizeClaims = (payload) => {
  const userId = ensureUserId(payload?.sub || payload?.userId);
  const jti = String(payload?.jti || "").trim();
  const sessionId = String(payload?.sessionId || "").trim();

  if (!jti || !sessionId) {
    throw new Error("JWT is missing required claims");
  }

  return {
    userId,
    role: String(payload?.role || "customer"),
    sessionId,
    familyId: payload?.familyId ? String(payload.familyId) : null,
    parentJti: payload?.parentJti ? String(payload.parentJti) : null,
    jti,
    issuedAt: payload?.iat ? new Date(payload.iat * 1000) : null,
    expiresAt: payload?.exp ? new Date(payload.exp * 1000) : null,
    claims: payload,
  };
};

const verifyToken = (token, tokenType, signer) => {
  const payload = jwt.verify(token, signer.verificationKey, {
    algorithms: signer.allowedAlgorithms,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    clockTolerance: 5,
  });

  if (payload?.type !== tokenType) {
    throw new Error("JWT token type mismatch");
  }

  return normalizeClaims(payload);
};

const signAccessToken = ({ userId, role, sessionId, extraClaims }) =>
  createToken({
    tokenType: "access",
    signer: ACCESS_SIGNER,
    userId,
    role,
    sessionId,
    extraClaims,
    expiresIn: env.ACCESS_TOKEN_TTL,
  });

const signRefreshToken = ({
  userId,
  role,
  sessionId,
  familyId,
  parentJti,
  extraClaims,
}) => {
  if (!familyId) {
    throw new Error("familyId is required for refresh token issuance");
  }

  return createToken({
    tokenType: "refresh",
    signer: REFRESH_SIGNER,
    userId,
    role,
    sessionId,
    familyId,
    parentJti,
    extraClaims,
    expiresIn: env.REFRESH_TOKEN_TTL,
  });
};

const verifyAccessToken = (token) => verifyToken(token, "access", ACCESS_SIGNER);
const verifyRefreshToken = (token) => verifyToken(token, "refresh", REFRESH_SIGNER);

const getJwtRuntimeInfo = () => ({
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  accessAlgorithm: ACCESS_SIGNER.algorithm,
  refreshAlgorithm: REFRESH_SIGNER.algorithm,
  accessTtl: env.ACCESS_TOKEN_TTL,
  refreshTtl: env.REFRESH_TOKEN_TTL,
});

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getJwtRuntimeInfo,
};
