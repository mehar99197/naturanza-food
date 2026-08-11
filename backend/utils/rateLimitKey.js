/**
 * Real-client-IP extraction for security-sensitive rate limiting.
 *
 * Express's `req.ip` is driven by `trust proxy` and, on Hostinger's
 * LiteSpeed/Passenger stack, ends up reading the left-most X-Forwarded-For
 * entry. That entry is client-spoofable, so an attacker can rotate `XFF`
 * values to bypass per-IP rate limits.
 *
 * This helper only trusts IP headers that the CDN/proxy *overwrites* with
 * the real client address (e.g. Cloudflare's CF-Connecting-IP, Hostinger's
 * X-Real-IP). If none are present we fall back to the direct socket address.
 *
 * Operators can override the trusted header via RATE_LIMIT_TRUSTED_IP_HEADER.
 */

const { stripToIp } = require("./clientIp");

const normalizeHeaderName = (name) => String(name || "").trim().toLowerCase();

const getRateLimitKey = (req) => {
  if (!req) return "unknown";

  const configuredHeader = normalizeHeaderName(
    process.env.RATE_LIMIT_TRUSTED_IP_HEADER,
  );
  if (configuredHeader) {
    const value = stripToIp(req.headers[configuredHeader]);
    if (value) return value;
  }

  // Common CDN/proxy headers that are overwritten by the edge and not
  // forwarded from the client.
  const cdnHeaders = ["cf-connecting-ip", "x-real-ip"];
  for (const header of cdnHeaders) {
    const value = stripToIp(req.headers[header]);
    if (value) return value;
  }

  // Direct connection IP. Behind a reverse proxy this is the proxy's address,
  // which is still better than a spoofable client header.
  const direct = stripToIp(req.socket?.remoteAddress);
  if (direct) return direct;

  // Last resort: Express's resolved IP. Only reliable when the app is not
  // behind a proxy that trusts XFF.
  return stripToIp(req.ip) || "unknown";
};

module.exports = { getRateLimitKey };
