const net = require("net");

const normalizeIp = (value) => {
  let ip = String(value || "").trim();
  if (!ip) return "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  // Strip IPv6 zone index (e.g. fe80::1%eth0)
  const zoneIndex = ip.indexOf("%");
  if (zoneIndex !== -1) ip = ip.slice(0, zoneIndex);
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
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

const ipv6ToBigInt = (ip) => {
  if (net.isIP(ip) !== 6) return null;

  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const parseSide = (side) => {
    if (!side) return [];
    const tokens = side.split(":");
    const groups = [];
    for (const token of tokens) {
      if (token.includes(".")) {
        const v4 = ipv4ToInt(token);
        if (v4 === null) return null;
        groups.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(token)) return null;
        groups.push(parseInt(token, 16));
      }
    }
    return groups;
  };

  const left = parseSide(halves[0]);
  const right = halves.length === 2 ? parseSide(halves[1]) : [];
  if (left === null || right === null) return null;

  const missing = 8 - (left.length + right.length);
  if ((halves.length === 2 && missing < 0) || (halves.length === 1 && missing !== 0)) {
    return null;
  }

  const full = halves.length === 2
    ? [...left, ...Array(missing).fill(0), ...right]
    : left;

  let result = 0n;
  for (const group of full) {
    result = (result << 16n) | BigInt(group);
  }
  return result;
};

const parseCidr = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const segments = raw.split("/");
  if (segments.length > 2) return null;
  const [ipPart, prefixPart] = segments;
  const ip = normalizeIp(ipPart);

  const ipValue = ipv4ToInt(ip);
  if (ipValue !== null) {
    let prefix = 32;
    if (typeof prefixPart !== "undefined") {
      if (!/^\d{1,2}$/.test(prefixPart)) return null;
      prefix = Number(prefixPart);
      if (prefix < 0 || prefix > 32) return null;
    }
    return { family: 4, ipValue, prefix, cidr: `${ip}/${prefix}` };
  }

  const ipv6Value = ipv6ToBigInt(ip);
  if (ipv6Value !== null) {
    let prefix = 128;
    if (typeof prefixPart !== "undefined") {
      if (!/^\d{1,3}$/.test(prefixPart)) return null;
      prefix = Number(prefixPart);
      if (prefix < 0 || prefix > 128) return null;
    }
    return { family: 6, ipv6Value, prefix, cidr: `${ip}/${prefix}` };
  }

  return null;
};

const ALL_128_BITS = (1n << 128n) - 1n;

const ipMatchesCidr = (ip, cidr) => {
  const normalizedIp = normalizeIp(ip);
  const parsedCidr = parseCidr(cidr);
  if (!normalizedIp || !parsedCidr) return false;

  if (parsedCidr.family === 4) {
    const parsedIp = ipv4ToInt(normalizedIp);
    if (parsedIp === null) return false;
    const hostBits = 32 - parsedCidr.prefix;
    const mask = parsedCidr.prefix === 0 ? 0 : (0xFFFFFFFF << hostBits) >>> 0;
    return ((parsedIp & mask) >>> 0) === ((parsedCidr.ipValue & mask) >>> 0);
  }

  const parsedIpv6 = ipv6ToBigInt(normalizedIp);
  if (parsedIpv6 === null) return false;
  if (parsedCidr.prefix === 0) return true;
  const hostBits = BigInt(128 - parsedCidr.prefix);
  const mask = (ALL_128_BITS << hostBits) & ALL_128_BITS;
  return (parsedIpv6 & mask) === (parsedCidr.ipv6Value & mask);
};

module.exports = {
  normalizeIp,
  parseCidr,
  ipMatchesCidr,
};
