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
const EXPRESSION_REGEX = /expression\s*\(/gi;

/**
 * Defence-in-depth scrubbing of markup-flavoured input.
 *
 * NOTE: this function must never DECODE anything. A previous version ran a
 * `decodeURIComponent` pass over every `%XX` sequence AFTER stripping angle
 * brackets, which meant a percent-encoded payload passed every filter and was
 * then decoded back into live markup — the sanitizer manufactured the exact
 * string it exists to block:
 *   "%3Cscript%3Ealert(1)%3C%2Fscript%3E"  ->  "<script>alert(1)</script>"
 * Decoding is the consumer's job (Express already decodes query/body); doing it
 * here can only re-introduce syntax that the steps above just removed.
 */
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

/**
 * Coarse SQL-shaped-payload screen, kept purely as defence in depth.
 *
 * Every query in this codebase is parameterized (`dbPool.query(sql, [params])`);
 * the only interpolated SQL fragments are literal column names built from
 * hard-coded arrays. So this check is not what stops injection — it is a
 * tripwire, and a tripwire that rejects real customer input is a net loss.
 *
 * Removed from the previous pattern set because they fire on ordinary prose and
 * add nothing on top of parameterization:
 *   - the SQL-comment marker pattern, which rejected "Honey & Ginger -- best
 *     seller" and any text containing a C-style comment opener
 *   - the bare `sleep(n)` pattern, which rejected a blog post about "sleep(8)
 *     hours a night"
 *
 * What remains are multi-keyword sequences that effectively never occur in a
 * product name, address, review, or support message.
 */
function isSafeSQLInput(input) {
    if (typeof input !== 'string') return true;

    const sqlInjectionPatterns = [
        /(\b(?:DROP\s+(?:TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION)|TRUNCATE\s+TABLE|ALTER\s+(?:TABLE|DATABASE|COLUMN))\b)/i,
        /(?:;\s*(?:DROP|TRUNCATE|ALTER|DELETE|EXEC)\b)/i,
        /(\bEXEC(?:UTE)?\s*\()/i,
        /(?:\bUNION\b\s+\bSELECT\b)/i,
        /(?:\bSELECT\b.*\bINTO\s+(?:OUT|DUMP)FILE\b)/i,
        /(?:\bLOAD\s+(?:DATA\s+INFILE|_FILE\s*\())/i,
        /(\bINSERT\s+INTO\b.*\bVALUES\b.*\bSELECT\b)/i,
        /(\bWAITFOR\s+DELAY\b)/i,
        /(\bBENCHMARK\s*\(\s*\d)/i,
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
