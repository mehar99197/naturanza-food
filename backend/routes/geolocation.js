const express = require('express');
const router = express.Router();

// Every value that reaches these handlers comes from a client-controlled source
// (a query param or a forwarded header), and it is interpolated into an outbound
// URL. Accept only something that is actually an IP address, so the request path
// sent to the geo provider can never be steered by the caller.
const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[0-9a-f:]+$/i;

const asValidIp = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  if (IPV4_REGEX.test(candidate)) {
    return candidate.split('.').every((part) => Number(part) <= 255) ? candidate : null;
  }
  return IPV6_REGEX.test(candidate) && candidate.includes(':') ? candidate : null;
};

// Currency mapping for countries
const CURRENCY_MAP = {
  'US': 'USD',
  'GB': 'GBP',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'IE': 'EUR',
  'FI': 'EUR',
  'PT': 'EUR',
  'GR': 'EUR',
  'PK': 'PKR',
  'IN': 'INR',
  'AE': 'AED',
  'SA': 'SAR',
  'CA': 'CAD',
  'AU': 'AUD',
  'JP': 'JPY',
  'CN': 'CNY',
  'BD': 'BDT',
  'MY': 'MYR',
  'SG': 'SGD',
  'TH': 'THB',
  'KR': 'KRW',
  'TR': 'TRY',
  'RU': 'RUB',
};

// Get currency based on user's IP location
router.get('/currency', async (req, res) => {
  try {
    // Use client-provided IP (from frontend ipify detection) first, fall back to request headers
    let userIP = String(req.query.ip || '').trim() ||
                 req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.socket.remoteAddress || 
                 req.connection.remoteAddress;
    
    // Extract first IP if multiple IPs are present
    if (userIP && userIP.includes(',')) {
      userIP = userIP.split(',')[0].trim();
    }

    // Remove IPv6 prefix if present
    if (userIP && userIP.includes('::ffff:')) {
      userIP = userIP.split('::ffff:')[1];
    }

    userIP = asValidIp(userIP);

    // For localhost/development, use a default or skip IP lookup
    if (!userIP || userIP === '127.0.0.1' || userIP === '::1' || userIP.startsWith('192.168.') || userIP.startsWith('10.')) {
      return res.json({
        country_code: 'PK',
        country_name: 'Pakistan',
        currency: 'PKR',
        source: 'default'
      });
    }

    // SECURITY: only proceed with a literal, well-formed IP address. Anything
    // else (path traversal / injected URL segments) falls back to the default and
    // is never interpolated into an outbound request URL.
    const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
    const IPV6_RE = /^[0-9a-fA-F:]+$/;
    if (!IPV4_RE.test(userIP) && !IPV6_RE.test(userIP)) {
      return res.json({
        country_code: 'PK',
        country_name: 'Pakistan',
        currency: 'PKR',
        source: 'default',
      });
    }

    // Both providers are HTTPS. The previous primary (ip-api.com) only serves
    // plaintext on its free tier, so anyone on the network path could rewrite
    // the response and choose the visitor's country — which selects the
    // currency shown on the storefront. ipwho.is is the same fallback provider
    // already used for admin login locations.
    let data;

    try {
      const response = await fetch(
        `https://ipapi.co/${encodeURIComponent(userIP)}/json/`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!response.ok) throw new Error('ipapi lookup failed');
      const body = await response.json();
      if (body?.error || !body?.country_code) throw new Error('ipapi lookup failed');
      data = body;
    } catch {
      const fallbackRes = await fetch(
        `https://ipwho.is/${encodeURIComponent(userIP)}`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!fallbackRes.ok) throw new Error('Geolocation service unavailable');
      const fallbackBody = await fallbackRes.json();
      if (fallbackBody?.success !== true) throw new Error('Geolocation service unavailable');
      data = {
        country_code: fallbackBody.country_code,
        country_name: fallbackBody.country,
      };
    }
    
    // Map country to currency
    const currency = CURRENCY_MAP[data.country_code] || data.currency || 'PKR';
    
    res.json({
      country_code: data.country_code,
      country_name: data.country_name,
      currency: currency,
      ip: userIP,
      source: 'ipapi'
    });

  } catch (error) {
    // Return default currency on error
    res.json({
      country_code: 'PK',
      country_name: 'Pakistan',
      currency: 'PKR',
      source: 'fallback',
      error: error.message
    });
  }
});

// Get full geolocation data
router.get('/info', async (req, res) => {
  try {
    let userIP = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.socket.remoteAddress;
    
    if (userIP && userIP.includes(',')) {
      userIP = userIP.split(',')[0].trim();
    }

    if (userIP && userIP.includes('::ffff:')) {
      userIP = userIP.split('::ffff:')[1];
    }

    // Anything that is not a bare IP is treated as absent — it must never reach
    // the outbound URL below.
    userIP = asValidIp(userIP);

    if (!userIP || userIP === '127.0.0.1' || userIP === '::1' || userIP.startsWith('192.168.') || userIP.startsWith('10.')) {
      return res.json({
        ip: userIP,
        country_code: 'PK',
        country_name: 'Pakistan',
        region: 'Punjab',
        city: 'Lahore',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        source: 'default'
      });
    }

    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(userIP)}/json/`,
      { signal: AbortSignal.timeout(4000) },
    );
    const data = await response.json();
    
    res.json({
      ...data,
      currency: CURRENCY_MAP[data.country_code] || data.currency || 'PKR',
      source: 'ipapi'
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to detect location',
      error: error.message 
    });
  }
});

module.exports = router;
