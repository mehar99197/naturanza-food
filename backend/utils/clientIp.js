/**
 * Canonical real-client-IP extraction for requests behind Hostinger's
 * LiteSpeed/Passenger reverse proxy.
 *
 * Express's `req.ip` (driven by `trust proxy`) lands on a Hostinger internal hop
 * here (e.g. 2a02:4780:…), so for DISPLAY/logging — login history, active
 * sessions, geolocation — we read the originating client from the forwarded
 * headers. The left-most X-Forwarded-For entry is the real client on this
 * infrastructure (verified against the working geolocation endpoint).
 *
 * Forwarded headers are client-spoofable, so this is for display/logging only.
 * Security-sensitive rate limiting keeps using Express's trust-proxy `req.ip`.
 */

// True only for a syntactically valid IPv4 or IPv6 literal. The forwarded headers
// this module reads are client-controlled, and the result is written to
// user_login_history and shown back to the user as a "recent login location"
// security signal; without this check an attacker sending
// `X-Forwarded-For: <arbitrary text>` could plant non-IP garbage into that field
// (CWE-348 / CWE-20). A spoofed *valid* IP is still possible on this infrastructure
// (see the module note) — that residual is accepted; this at least guarantees the
// stored value is a real IP.
const isValidIpFormat = (ip) => {
  if (!ip) return false;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255);
  }
  // IPv6: hex groups and colons only, and it must actually contain a colon.
  return ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip);
};

// Reduce a raw header value to a bare IP (strip brackets, IPv4-mapped IPv6, port).
const stripToIp = (raw) => {
  let value = String(raw || "").trim();
  if (!value) return null;

  // "[2a02::1]:443" -> "2a02::1"
  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }
  // "::ffff:1.2.3.4" -> "1.2.3.4"
  if (value.toLowerCase().startsWith("::ffff:")) {
    value = value.slice(7);
  }
  // "1.2.3.4:5678" -> "1.2.3.4" (IPv4 with port only; never split bare IPv6)
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.split(":")[0];
  }

  if (!value || value.toLowerCase() === "unknown") return null;
  return isValidIpFormat(value) ? value : null;
};

// True for loopback / private / link-local addresses (and missing values).
const isPrivateOrLocal = (ip) => {
  if (!ip) return true;
  const v = ip.toLowerCase();
  return (
    v === "::1" ||
    v.startsWith("127.") ||
    v.startsWith("10.") ||
    v.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    v.startsWith("169.254.") ||
    v.startsWith("fe80") ||
    v.startsWith("fc") ||
    v.startsWith("fd")
  );
};

// Pick the originating client from an X-Forwarded-For chain: the first PUBLIC
// entry (left-most = original client), falling back to the first entry.
const firstForwardedIp = (xff) => {
  if (!xff) return null;
  const parts = String(xff)
    .split(",")
    .map((part) => stripToIp(part))
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.find((ip) => !isPrivateOrLocal(ip)) || parts[0];
};

/**
 * Returns the best-guess real client IP for the request, or null.
 */
const getClientIp = (req) => {
  if (!req) return null;
  const candidates = [
    firstForwardedIp(req.headers?.["x-forwarded-for"]),
    stripToIp(req.headers?.["cf-connecting-ip"]),
    stripToIp(req.headers?.["x-real-ip"]),
    stripToIp(req.ip),
    stripToIp(req.socket?.remoteAddress),
    stripToIp(req.connection?.remoteAddress),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
};

module.exports = { getClientIp, isPrivateOrLocal };
