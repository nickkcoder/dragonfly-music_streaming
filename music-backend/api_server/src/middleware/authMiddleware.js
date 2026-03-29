const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Ensure environment variables exist
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in .env');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;

/* ============================================================
   PASSWORD HELPERS
   ============================================================ */

/**
 * Hash a password
 */
async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compare password to hash
 */
async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}


/* ============================================================
   JWT HELPERS
   ============================================================ */

/**
 * Create a signed JWT
 */
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify & decode JWT
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}


/* ============================================================
   MIDDLEWARE
   ============================================================ */

/**
 * Protect private routes
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = verifyToken(token);

        // Optional account verification check
        if (payload.isVerified === false) {
            return res.status(403).json({ message: 'Account not verified' });
        }

        req.user = payload; // user_id, email, roles, etc.
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * Restrict route access by role(s)
 * Example:
 *     requireRole("artist")
 *     requireRole("admin", "staff")
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (!req.user.roles) {
            return res.status(403).json({ message: 'Forbidden: no role assigned' });
        }

        if (!allowedRoles.includes(req.user.roles)) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }

        next();
    };
}


// EXPORTS
module.exports = {
    hashPassword,
    comparePassword,
    signToken,
    verifyToken,
    authMiddleware,
    requireRole
};
