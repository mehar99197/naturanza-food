const LOCATION_TIMEOUT_MS =
  Number.parseInt(process.env.IP_LOOKUP_TIMEOUT_MS || "4000", 10) || 4000;
const LOCATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const locationCache = new Map();

const isPrivateOrLocalIp = (ipAddress) => {
  let ip = String(ipAddress || "").trim().toLowerCase();
  if (!ip) return true;
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "localhost") return true;
  if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) {
    return true;
  }
  const private172 = ip.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
};

const resolveAdminIpLocation = async (ipAddress) => {
  const ip = String(ipAddress || "").trim();
  if (!ip) return "Unknown";
  if (isPrivateOrLocalIp(ip)) return "Local Network";

  const cached = locationCache.get(ip);
  if (cached && Date.now() - cached.ts < LOCATION_CACHE_TTL_MS) {
    return cached.location;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCATION_TIMEOUT_MS);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return "Unknown";
    const data = await response.json();
    if (data?.success !== true) return "Unknown";

    const resolved =
      [data.city, data.region, data.country]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(", ") || "Unknown";

    if (locationCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = locationCache.keys().next().value;
      if (oldestKey !== undefined) locationCache.delete(oldestKey);
    }
    locationCache.set(ip, { location: resolved, ts: Date.now() });
    return resolved;
  } catch {
    return "Unknown";
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { resolveAdminIpLocation };