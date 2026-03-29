const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header missing' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * requireRole middleware with DB fallback.
 *
 * If the JWT role is not in allowedRoles (e.g. user became an artist
 * after their token was issued), we do a live DB lookup on the users table.
 * This avoids forcing a re-login after role changes.
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }

        // Fast path: JWT role is already sufficient
        if (allowedRoles.includes(req.user.roles)) {
            return next();
        }

        // Slow path: JWT role is stale — check the DB for the current role
        try {
            const [rows] = await pool.query(
                'SELECT roles FROM users WHERE user_id = ? LIMIT 1',
                [req.user.user_id]
            );

            if (rows.length > 0 && allowedRoles.includes(rows[0].roles)) {
                // Patch the in-request user object so downstream handlers see the current role
                req.user.roles = rows[0].roles;
                return next();
            }
        } catch (_) {
            // DB lookup failed — fall through to 403
        }

        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    };
}

module.exports = {
    authMiddleware,
    requireRole
};
