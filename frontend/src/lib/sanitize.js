import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - HTML string to sanitize
 * @param {object} config - DOMPurify configuration
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHTML(dirty, config = {}) {
  const defaultConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
    ...config
  };

  return DOMPurify.sanitize(dirty, defaultConfig);
}

/**
 * Sanitize user input (remove dangerous characters)
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove < and > to prevent HTML injection
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Sanitize text for display (strict)
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  
  // Remove all HTML tags
  return text
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Sanitize email input
 * @param {string} email - Email to sanitize
 * @returns {string} - Sanitized email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, '');
}

/**
 * Sanitize URL
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') return '';
  
  // Only allow http and https protocols
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Validate and sanitize form data
 * @param {object} formData - Form data to sanitize
 * @returns {object} - Sanitized form data
 */
export function sanitizeFormData(formData) {
  const sanitized = {};
  
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      const value = formData[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeFormData(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Escape special characters for safe display
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Check if string contains potential XSS
 * @param {string} str - String to check
 * @returns {boolean} - True if potentially dangerous
 */
export function containsXSS(str) {
  if (typeof str !== 'string') return false;
  
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(str));
}
