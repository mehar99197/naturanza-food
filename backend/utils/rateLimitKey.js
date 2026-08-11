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
 * The returned IP is passed through express-rate-limit's `ipKeyGenerator`
 * helper so IPv6 clients are keyed by subnet (default /56) rather than by
 * their full address. This prevents IPv6 users from bypassing limits by
 * rotating addresses.
 *
 * Operators can override the trusted header via RATE_LIMIT_TRUSTED_IP_HEADER.
 */

const { ipKeyGenerator } = require("express-rate-limit");
const { stripToIp } = require("./clientIp");

const normalizeHeaderName = (name) => String(name || "").trim().toLowerCase();

const getRateLimitKey = (req) => {
  if (!req) return "unknown";

  const configuredHeader = normalizeHeaderName(
    process.env.RATE_LIMIT_TRUSTED_IP_HEADER,
  );
  if (configuredHeader) {
    const value = stripToIp(req.headers[configuredHeader]);
    if (value) return ipKeyGenerator(value);
  }

  // Common CDN/proxy headers that are overwritten by the edge and not
  // forwarded from the client.
  const cdnHeaders = ["cf-connecting-ip", "x-real-ip"];
  for (const header of cdnHeaders) {
    const value = stripToIp(req.headers[header]);
    if (value) return ipKeyGenerator(value);
  }

  // Direct connection IP. Behind a reverse proxy this is the proxy's address,
  // which is still better than a spoofable client header.
  const direct = stripToIp(req.socket?.remoteAddress);
  if (direct) return ipKeyGenerator(direct);

  // Last resort: Express's resolved IP. Only reliable when the app is not
  // behind a proxy that trusts XFF.
  return ipKeyGenerator(stripToIp(req.ip) || "unknown");
};

module.exports = { getRateLimitKey };
