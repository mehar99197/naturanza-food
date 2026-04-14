const express = require('express');
const router = express.Router();

// Currency mapping for countries
const CURRENCY_MAP = {
  'US': 'USD',
  'GB': 'GBP',
  'EU': 'EUR',
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
};

// Get currency based on user's IP location
router.get('/currency', async (req, res) => {
  try {
    // Get user's IP from request
    let userIP = req.headers['x-forwarded-for'] || 
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

    // Call IP geolocation service (using ipapi.co - free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${userIP}/json/`);
    
    if (!response.ok) {
      throw new Error('Geolocation service unavailable');
    }

    const data = await response.json();
    
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
    console.error('Geolocation error:', error);
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
