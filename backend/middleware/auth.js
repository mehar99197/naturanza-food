const { db } = require("../config/db");
const { touchSessionByToken } = require("../utils/sessionManager");
const { verifyAccessToken } = require("../utils/jwtTokens");
const { isAccessTokenBlacklisted } = require("../utils/tokenStore");

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }

    const userId = Number(payload?.sub || payload?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(403).json({ error: "Invalid token subject" });
    }

    try {
        const revoked = await isAccessTokenBlacklisted(db.promise(), payload.jti);
        if (revoked) {
            return res.status(401).json({ error: "Session revoked. Please log in again." });
        }

        const session = await touchSessionByToken(db.promise(), token);
        if (!session) {
            return res.status(401).json({ error: "Session expired. Please log in again." });
        }

        if (!session.is_active) {
            return res.status(401).json({ error: "Session revoked. Please log in again." });
        }

        const [userRows] = await db
            .promise()
            .query("SELECT id, email, name, role, admin_role, admin_permissions, profile_image, is_active FROM users WHERE id = ? LIMIT 1", [userId]);

        if (!userRows.length) {
            return res.status(401).json({ error: "User account not found" });
        }

        if (!userRows[0].is_active) {
            return res.status(403).json({ error: "Account is disabled. Please contact support." });
        }

        // Parse admin_permissions if it's a JSON string
        let adminPermissions = userRows[0].admin_permissions;
        if (typeof adminPermissions === 'string') {
            try {
                adminPermissions = JSON.parse(adminPermissions);
            } catch (e) {
                adminPermissions = null;
            }
        }

        req.user = {
            id: userRows[0].id,
            email: userRows[0].email,
            name: userRows[0].name,
            role: userRows[0].role,
            admin_role: userRows[0].admin_role,
            admin_permissions: adminPermissions,
            profile_image: userRows[0].profile_image,
            jti: payload.jti,
        };
        req.token = token;
        next();
    } catch (error) {
        return res.status(500).json({ error: "Authentication service unavailable" });
    }
};

const optionalAuthenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
        return next();
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch (error) {
        req.authError = "Invalid or expired token";
        return next();
    }

    const userId = Number(payload?.sub || payload?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
        req.authError = "Invalid token subject";
        return next();
    }

    try {
        const revoked = await isAccessTokenBlacklisted(db.promise(), payload.jti);
        if (revoked) {
            req.authError = "Session revoked";
            return next();
        }

        const session = await touchSessionByToken(db.promise(), token);
        if (!session || !session.is_active) {
            req.authError = "Session expired";
            return next();
        }

        const [userRows] = await db
            .promise()
            .query("SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1", [userId]);

        if (!userRows.length) {
            req.authError = "User account not found";
            return next();
        }

        if (!userRows[0].is_active) {
            req.authError = "Account is disabled";
            return next();
        }

        req.user = {
            id: userRows[0].id,
            email: userRows[0].email,
            role: userRows[0].role,
            jti: payload.jti,
        };
        req.token = token;
        return next();
    } catch (error) {
        req.authError = "Authentication service unavailable";
        return next();
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (String(req.user?.role || "").trim().toLowerCase() !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};

module.exports = { authenticateToken, optionalAuthenticateToken, isAdmin };
