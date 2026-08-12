const LOCATION_TIMEOUT_MS = Number.parseInt(
  process.env.IP_LOOKUP_TIMEOUT_MS || "4000",
  10,
);

const resolveAdminIpLocation = async (ipAddress) => {
  const ip = String(ipAddress || "").trim();
  if (!ip) return "Unknown";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCATION_TIMEOUT_MS);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return "Unknown";
    const data = await response.json();
    if (data?.success !== true) return "Unknown";

    return [data.city, data.region, data.country]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ") || "Unknown";
  } catch {
    return "Unknown";
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { resolveAdminIpLocation };