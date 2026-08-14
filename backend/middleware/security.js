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

const isOpaqueTokenField = (key) =>
    typeof key === 'string' &&
    (OPAQUE_TOKEN_FIELDS.has(key.toLowerCase()) ||
        PASSWORD_FIELDS.has(key.toLowerCase()));

const JS_PROTOCOL_REGEX = /^\s*javascript\s*:/i;
const DATA_PROTOCOL_REGEX = /^\s*data\s*:/i;
const VBSCRIPT_PROTOCOL_REGEX = /^\s*vbscript\s*:/i;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;
const EXPRESSION_REGEX = /expression\s*\(/gi;

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

    // NOTE: percent-decoding must never happen here. A decode pass used to run
    // at this point and rebuilt exactly what the passes above had just removed:
    // "%3Cimg src%3Dx onerror%3Dalert(1)%3E" came back out as working markup,
    // because the event-handler pattern above needs a literal "=" to match and
    // "%3D" does not provide one. Encoded input is left as inert literal text;
    // anything that genuinely needs a decoded value must decode it itself, at
    // the point of use, where the destination is known.

    return sanitized.trim();
}

// Keys that are not data. Assigning to "__proto__" invokes the prototype setter
// instead of creating a property, so a body of {"__proto__":{"role":"admin"}}
// produced an object where Object.keys() was clean but obj.role was "admin" —
// restrictBody's mass-assignment guard reads Object.keys(), so it saw nothing to
// reject while handlers could still read the injected value off the prototype.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (FORBIDDEN_KEYS.has(key)) {
                continue;
            }

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

// NOTE: a keyword blocklist (isSafeSQLInput / preventSQLInjection) used to sit
// here and reject any request whose body or query contained "-- ", "/*",
// "UNION SELECT", "sleep(n)" and similar. It protected nothing — every query in
// this codebase is parameterised, which is what actually prevents SQL injection
// — while rejecting ordinary customer text with a bare "Invalid input detected".
// "Deliver 9-5 -- thanks" in an order note or a contact message was a 400.
// Removed rather than narrowed: a blocklist in front of parameterised SQL can
// only ever produce false positives.

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
    restrictBody,
};
