const normalizeIp = (value) => {
  let ip = String(value || "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip.toLowerCase();
};

const ipv4ToInt = (ip) => {
  const parts = String(ip || "").split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = (value * 256) + octet;
  }
  return value >>> 0;
};

const parseCidr = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const [ipPart, prefixPart] = raw.split("/");
  const ip = normalizeIp(ipPart);
  const ipValue = ipv4ToInt(ip);
  if (ipValue === null) return null;

  let prefix = 32;
  if (typeof prefixPart !== "undefined") {
    if (!/^\d{1,2}$/.test(prefixPart)) return null;
    prefix = Number(prefixPart);
    if (prefix < 0 || prefix > 32) return null;
  }

  return { ipValue, prefix, cidr: `${ip}/${prefix}` };
};

const ipMatchesCidr = (ip, cidr) => {
  const parsedIp = ipv4ToInt(normalizeIp(ip));
  const parsedCidr = parseCidr(cidr);
  if (parsedIp === null || !parsedCidr) return false;

  const hostBits = 32 - parsedCidr.prefix;
  const mask = parsedCidr.prefix === 0 ? 0 : (0xFFFFFFFF << hostBits) >>> 0;
  return ((parsedIp & mask) >>> 0) === ((parsedCidr.ipValue & mask) >>> 0);
};

module.exports = {
  normalizeIp,
  parseCidr,
  ipMatchesCidr,
};
