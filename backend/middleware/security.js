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

const HTML_ENTITY_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
};

const ESCAPE_REGEX = /[&<>"'/]/g;

const escapeHTML = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(ESCAPE_REGEX, (char) => HTML_ENTITY_MAP[char]);
};

const JS_PROTOCOL_REGEX = /^\s*javascript\s*:/i;
const DATA_PROTOCOL_REGEX = /^\s*data\s*:/i;
const VBSCRIPT_PROTOCOL_REGEX = /^\s*vbscript\s*:/i;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;
const SVG_SCRIPT_REGEX = /<svg[^>]*>(.*?)<\/svg>/gi;
const EXPRESSION_REGEX = /expression\s*\(/gi;
const URL_ENCODED_INJECTION_REGEX = /%[0-9a-f]{2}/gi;

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    let sanitized = input;

    sanitized = sanitized.replace(/<[^>]*>/g, (match) => {
        if (match.toLowerCase().startsWith('<script') ||
            match.toLowerCase().startsWith('<iframe') ||
            match.toLowerCase().startsWith('<object') ||
            match.toLowerCase().startsWith('<embed') ||
            match.toLowerCase().startsWith('<svg')) {
            return '';
        }
        return match.replace(/on\w+\s*=/gi, 'data-safe-');
    });

    sanitized = sanitized.replace(/[<>]/g, '');

    sanitized = sanitized.replace(JS_PROTOCOL_REGEX, '')
        .replace(DATA_PROTOCOL_REGEX, '')
        .replace(VBSCRIPT_PROTOCOL_REGEX, '');

    sanitized = sanitized.replace(EVENT_HANDLER_REGEX, '')
        .replace(EXPRESSION_REGEX, '');

    sanitized = sanitized.replace(URL_ENCODED_INJECTION_REGEX, (match) => {
        try {
            return decodeURIComponent(match);
        } catch {
            return '';
        }
    });

    return sanitized.trim();
}

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

function sanitizeRequestBody(req, res, next) {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    next();
}

function sanitizeQueryParams(req, res, next) {
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    next();
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const minLength = 12;
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
        message: !isValid ? 'Password must be at least 12 characters with uppercase, lowercase, and numbers' : ''
    };
}

function isSafeSQLInput(input) {
    if (typeof input !== 'string') return true;

    const sqlInjectionPatterns = [
        /(\b(?:DROP\s+(?:TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION)|TRUNCATE\s+TABLE|ALTER\s+(?:TABLE|DATABASE|COLUMN))\b)/gi,
        /(?:;\s*(?:DROP|TRUNCATE|ALTER|DELETE|EXEC)\b)/gi,
        /(\bEXEC(?:UTE)?\s*\()/gi,
        /(?:\bUNION\b\s+\bSELECT\b)/gi,
        /(?:\bSELECT\b.*\bINTO\s+(?:OUT|DUMP)FILE\b)/gi,
        /(?:\bLOAD\s+(?:DATA|FILE)\b)/gi,
        /(?:--\s|\/\*!|\/\*)/gi,
        /(\bINSERT\s+INTO\b.*\bVALUES\b.*\bSELECT\b)/gi,
        /(\bWAITFOR\s+DELAY\b)/gi,
        /(\bBENCHMARK\b\s*\()/gi,
        /(sleep\s*\(\s*\d+\s*\))/gi,
    ];

    return !sqlInjectionPatterns.some(pattern => pattern.test(input));
}

function preventSQLInjection(req, res, next) {
    const checkObject = (obj) => {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
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

function restrictBody(...allowedFields) {
    const allowedSet = new Set(allowedFields);
    return (req, res, next) => {
        if (!req.body || typeof req.body !== 'object') {
            return next();
        }
        const extraFields = Object.keys(req.body).filter(key => !allowedSet.has(key));
        if (extraFields.length > 0) {
            return res.status(400).json({
                error: `Unexpected fields: ${extraFields.join(', ')}`
            });
        }
        next();
    };
}

module.exports = {
    sanitizeInput,
    sanitizeObject,
    sanitizeRequestBody,
    sanitizeQueryParams,
    isValidEmail,
    validatePassword,
    isSafeSQLInput,
    preventSQLInjection,
    restrictBody,
    escapeHTML,
};
