const jwt = require('jsonwebtoken');
const { touchSessionByToken } = require('../utils/sessionManager');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        try {
            if (global.db?.promise) {
                const session = await touchSessionByToken(global.db.promise(), token);

                if (!session) {
                    return res.status(401).json({ error: 'Session expired. Please log in again.' });
                }

                if (!session.is_active) {
                    return res.status(401).json({ error: 'Session revoked. Please log in again.' });
                }

                const [userRows] = await global.db
                    .promise()
                    .query('SELECT is_active FROM users WHERE id = ? LIMIT 1', [user.id]);

                if (!userRows.length) {
                    return res.status(401).json({ error: 'User account not found' });
                }

                if (!userRows[0].is_active) {
                    return res.status(403).json({ error: 'Account is disabled. Please contact support.' });
                }
            }
        } catch (sessionError) {
            // If session table is temporarily unavailable, continue with JWT validation.
        }

        req.user = user;
        req.token = token;
        next();
    });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authenticateToken, isAdmin };
