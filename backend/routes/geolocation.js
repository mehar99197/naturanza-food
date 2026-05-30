const express = require('express');
const router = express.Router();

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

    // Call IP geolocation service (ip-api.com - free, no key, 45 req/min)
    const controller = new AbortController();
    const geoTimeout = setTimeout(() => controller.abort(), 4000);
    let data;

    try {
      const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(userIP)}?fields=status,country,countryCode`, {
        signal: controller.signal,
      });
      const body = await response.json();
      if (body.status === 'success') {
        data = { country_code: body.countryCode, country_name: body.country };
      } else {
        throw new Error('ip-api lookup failed');
      }
    } catch {
      // Fall back to ipapi.co
      const fallbackRes = await fetch(`https://ipapi.co/${encodeURIComponent(userIP)}/json/`, { signal: AbortSignal.timeout(4000) });
      if (!fallbackRes.ok) throw new Error('Geolocation service unavailable');
      data = await fallbackRes.json();
    } finally {
      clearTimeout(geoTimeout);
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

    const response = await fetch(`https://ipapi.co/${userIP}/json/`);
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
