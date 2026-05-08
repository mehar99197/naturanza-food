/**
 * Security Middleware
 * Provides input sanitization and validation
 */

const OPAQUE_TOKEN_FIELDS = new Set([
    'idtoken',
    'credential',
    'token',
    'access_token',
    'accesstoken',
    'refresh_token',
    'refreshtoken',
    'authorization',
]);

const PASSWORD_FIELDS = new Set([
    'password',
    'currentpassword',
    'newpassword',
    'confirmpassword',
    'confirmnewpassword',
    'current_password',
    'new_password',
    'confirm_password',
]);

const CONFIRMATION_FIELDS = new Set([
    'confirmationtext',
    'confirmation_text',
    'confirmtext',
]);

const isOpaqueTokenField = (key) =>
    typeof key === 'string' &&
    (OPAQUE_TOKEN_FIELDS.has(key.toLowerCase()) ||
        PASSWORD_FIELDS.has(key.toLowerCase()));

const isExcludedFromSQLCheck = (key) =>
    typeof key === 'string' &&
    (OPAQUE_TOKEN_FIELDS.has(key.toLowerCase()) ||
        PASSWORD_FIELDS.has(key.toLowerCase()) ||
        CONFIRMATION_FIELDS.has(key.toLowerCase()));

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove potentially dangerous characters
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove inline event handlers
        .trim();
}

/**
 * Sanitize object recursively
 * @param {object} obj - Object to sanitize
 * @returns {object} - Sanitized object
 */
function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            
            if (typeof value === 'string') {
                sanitized[key] = isOpaqueTokenField(key)
                    ? value.trim()
                    : sanitizeInput(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
    }

    return sanitized;
}

/**
 * Middleware to sanitize request body
 */
function sanitizeRequestBody(req, res, next) {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    next();
}

/**
 * Middleware to sanitize query parameters
 */
function sanitizeQueryParams(req, res, next) {
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    next();
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result
 */
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const isValid = password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;

    return {
        isValid,
        requirements: {
            length: password.length >= minLength,
            uppercase: hasUpperCase,
            lowercase: hasLowerCase,
            number: hasNumber,
            special: hasSpecial
        },
        message: !isValid ? 'Password must be at least 8 characters with uppercase, lowercase, and numbers' : ''
    };
}

/**
 * Prevent SQL injection by validating input
 * @param {string} input - Input to validate
 * @returns {boolean} - True if safe
 */
function isSafeSQLInput(input) {
    if (typeof input !== 'string') return true;

    // Check for SQL injection patterns — only flag dangerous sequences
    // that indicate an active injection attempt, not normal words.
    const sqlInjectionPatterns = [
        /(\b(?:DROP\s+(?:TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION)|TRUNCATE\s+TABLE|ALTER\s+(?:TABLE|DATABASE|COLUMN))\b)/gi,
        /(?:;\s*(?:DROP|TRUNCATE|ALTER|DELETE|EXEC)\b)/gi,
        /(\bEXEC(?:UTE)?\s*\()/gi,
        /(?:\bUNION\b\s+\bSELECT\b)/gi,
        /(?:\bSELECT\b.*\bINTO\s+(?:OUT|DUMP)FILE\b)/gi,
        /(?:\bLOAD\s+(?:DATA|FILE)\b)/gi,
        /(?:--\s|\/\*!|\/\*)/gi,
    ];

    return !sqlInjectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Middleware to validate SQL injection attempts
 */
function preventSQLInjection(req, res, next) {
    const checkObject = (obj) => {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Skip SQL injection check for excluded fields (passwords, tokens, confirmation text)
                if (isExcludedFromSQLCheck(key)) {
                    continue;
                }

                if (typeof obj[key] === 'string' && !isSafeSQLInput(obj[key])) {
                    return false;
                }
                if (typeof obj[key] === 'object' && !checkObject(obj[key])) {
                    return false;
                }
            }
        }
        return true;
    };

    if (req.body && !checkObject(req.body)) {
        return res.status(400).json({ error: 'Invalid input detected' });
    }

    if (req.query && !checkObject(req.query)) {
        return res.status(400).json({ error: 'Invalid query parameters' });
    }

    next();
}

module.exports = {
    sanitizeInput,
    sanitizeObject,
    sanitizeRequestBody,
    sanitizeQueryParams,
    isValidEmail,
    validatePassword,
    isSafeSQLInput,
    preventSQLInjection
};
