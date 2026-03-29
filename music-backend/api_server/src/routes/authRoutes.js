const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { hashPassword, comparePassword, signToken } = require('../middleware/authMiddleware');

/* ============================================================
   REGISTER
   ============================================================ */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        // Check email
        const [existing] = await pool.query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Check username
        const [userExists] = await pool.query(
            'SELECT user_id FROM users WHERE username = ?',
            [username]
        );
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        // Hash password
        const hashed = await hashPassword(password);

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_h, roles) VALUES (?, ?, ?, ?)',
            [username, email, hashed, 'user']
        );

        return res.status(201).json({
            user_id: result.insertId,
            message: 'User registered successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Register error', error: err.message });
    }
});


/* ============================================================
   LOGIN (email OR username)
   ============================================================ */
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        // Must provide password + (email OR username)
        if (!password || (!email && !username)) {
            return res.status(400).json({
                message: 'Email or username AND password required'
            });
        }

        let query, value;

        if (email) {
            query = `
                SELECT user_id, username, email, password_h, roles 
                FROM users 
                WHERE email = ?
            `;
            value = email;
        } else {
            query = `
                SELECT user_id, username, email, password_h, roles 
                FROM users 
                WHERE username = ?
            `;
            value = username;
        }

        const [rows] = await pool.query(query, [value]);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];

        // Check password
        const valid = await comparePassword(password, user.password_h);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT
        const token = signToken({
            user_id: user.user_id,
            username: user.username,
            roles: user.roles
        });

        return res.json({
            token,
            message: 'Login successful'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login error', error: err.message });
    }
});

/* ============================================================
   GET CURRENT USER PROFILE
   ============================================================ */
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const userId = req.user.user_id;
        await ensureProfileColumns();

        const [rows] = await pool.query(
            'SELECT user_id, username, email, bio, accent, avatar_url AS avatarUrl, roles, created_at FROM users WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching profile', error: err.message });
    }
});

/* ============================================================
   UPDATE CURRENT USER PROFILE
   ============================================================ */
let profileColumnsEnsured = false;
let settingsTableEnsured = false;
let supportTableEnsured = false;

async function ensureProfileColumns() {
    if (profileColumnsEnsured) return;
    // MySQL 8.0+ supports ADD COLUMN IF NOT EXISTS; for broader compatibility
    // we check information_schema first.
    const dbName = process.env.DB_NAME || 'dragonflydb';
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
           AND COLUMN_NAME IN ('bio', 'accent', 'avatar_url')`,
        [dbName]
    );
    const existing = new Set(cols.map(c => c.COLUMN_NAME));

    if (!existing.has('bio')) {
        await pool.query('ALTER TABLE users ADD COLUMN bio TEXT NULL');
    }
    if (!existing.has('accent')) {
        await pool.query('ALTER TABLE users ADD COLUMN accent VARCHAR(32) NULL');
    }
    if (!existing.has('avatar_url')) {
        await pool.query('ALTER TABLE users ADD COLUMN avatar_url TEXT NULL');
    }
    profileColumnsEnsured = true;
}

async function ensureSettingsTable() {
    if (settingsTableEnsured) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS user_settings (
            user_id INT NOT NULL PRIMARY KEY,
            privacy_json LONGTEXT NULL,
            notifications_json LONGTEXT NULL,
            playback_json LONGTEXT NULL,
            artist_json LONGTEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    );
    settingsTableEnsured = true;
}

async function ensureSupportTable() {
    if (supportTableEnsured) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS support_tickets (
            ticket_id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            email VARCHAR(255) NULL,
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    supportTableEnsured = true;
}

function safeParseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function defaultSettings() {
    return {
        privacy: {
            publicProfile: true,
            showLikedSongs: true,
            showListeningActivity: true
        },
        notifications: {
            emailReleases: true,
            emailFollows: true,
            adminAlerts: true,
            marketing: false
        },
        playback: {
            autoplay: true,
            explicitFilter: false,
            defaultVolume: 70
        },
        artistTools: {
            payoutEmail: '',
            paypal: '',
            instagram: '',
            tiktok: '',
            website: ''
        }
    };
}

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { username, bio, accent } = req.body;
        const avatarProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar');
        const avatar = avatarProvided ? req.body.avatar : undefined;

        if (!username || username.trim() === '') {
            return res.status(400).json({ message: 'Username is required' });
        }

        // Add bio / accent / avatar_url columns if this is the first time
        await ensureProfileColumns();

        // Ensure the new username isn't taken by someone else
        const [existingUser] = await pool.query(
            'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
            [username.trim(), userId]
        );
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        if (avatarProvided) {
            await pool.query(
                'UPDATE users SET username = ?, bio = ?, accent = ?, avatar_url = ? WHERE user_id = ?',
                [
                    username.trim(),
                    bio ? bio.trim() : null,
                    accent || null,
                    avatar || null,
                    userId
                ]
            );
        } else {
            await pool.query(
                'UPDATE users SET username = ?, bio = ?, accent = ? WHERE user_id = ?',
                [
                    username.trim(),
                    bio ? bio.trim() : null,
                    accent || null,
                    userId
                ]
            );
        }

        const [rows] = await pool.query(
            'SELECT user_id, username, email, bio, accent, avatar_url AS avatarUrl, roles FROM users WHERE user_id = ?',
            [userId]
        );

        return res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
});

/* ============================================================
   LOGOUT
   ============================================================ */
router.post('/logout', authMiddleware, (req, res) => {
    // JWT is stateless — the client is responsible for discarding the token.
    // This endpoint exists so the frontend has a clean contract to call.
    return res.json({ message: 'Logged out successfully' });
});

/* ============================================================
   FORGOT PASSWORD (request reset)
   ============================================================ */
router.post('/forgot-password', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        const [rows] = await pool.query(
            'SELECT user_id FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        // Placeholder response: integrate email service / token flow later.
        if (rows.length > 0) {
            return res.json({ message: 'Check your inbox for reset instructions.' });
        }

        return res.json({ message: 'If that email exists, we sent reset instructions.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error starting password reset', error: err.message });
    }
});

/* ============================================================
   USER SETTINGS
   ============================================================ */
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        await ensureSettingsTable();
        const base = defaultSettings();
        const [rows] = await pool.query(
            'SELECT privacy_json, notifications_json, playback_json, artist_json FROM user_settings WHERE user_id = ?',
            [req.user.user_id]
        );

        if (rows.length === 0) {
            return res.json(base);
        }

        const row = rows[0];
        return res.json({
            privacy: safeParseJson(row.privacy_json, base.privacy),
            notifications: safeParseJson(row.notifications_json, base.notifications),
            playback: safeParseJson(row.playback_json, base.playback),
            artistTools: safeParseJson(row.artist_json, base.artistTools)
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching settings', error: err.message });
    }
});

router.put('/settings', authMiddleware, async (req, res) => {
    try {
        await ensureSettingsTable();
        const base = defaultSettings();
        const [rows] = await pool.query(
            'SELECT privacy_json, notifications_json, playback_json, artist_json FROM user_settings WHERE user_id = ?',
            [req.user.user_id]
        );

        const current = rows.length
            ? {
                privacy: safeParseJson(rows[0].privacy_json, base.privacy),
                notifications: safeParseJson(rows[0].notifications_json, base.notifications),
                playback: safeParseJson(rows[0].playback_json, base.playback),
                artistTools: safeParseJson(rows[0].artist_json, base.artistTools)
            }
            : base;

        const next = {
            privacy: { ...current.privacy, ...(req.body?.privacy || {}) },
            notifications: { ...current.notifications, ...(req.body?.notifications || {}) },
            playback: { ...current.playback, ...(req.body?.playback || {}) },
            artistTools: { ...current.artistTools, ...(req.body?.artistTools || {}) }
        };

        await pool.query(
            `INSERT INTO user_settings (user_id, privacy_json, notifications_json, playback_json, artist_json)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                privacy_json = VALUES(privacy_json),
                notifications_json = VALUES(notifications_json),
                playback_json = VALUES(playback_json),
                artist_json = VALUES(artist_json)`,
            [
                req.user.user_id,
                JSON.stringify(next.privacy),
                JSON.stringify(next.notifications),
                JSON.stringify(next.playback),
                JSON.stringify(next.artistTools)
            ]
        );

        return res.json(next);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating settings', error: err.message });
    }
});

/* ============================================================
   ACCOUNT UPDATES
   ============================================================ */
router.put('/email', authMiddleware, async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        const password = String(req.body?.password || '');

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const [userRows] = await pool.query(
            'SELECT user_id, password_h FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const valid = await comparePassword(password, userRows[0].password_h);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid password.' });
        }

        const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing.length > 0 && existing[0].user_id !== req.user.user_id) {
            return res.status(400).json({ message: 'Email already in use.' });
        }

        await pool.query('UPDATE users SET email = ? WHERE user_id = ?', [email, req.user.user_id]);
        return res.json({ message: 'Email updated.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating email', error: err.message });
    }
});

router.put('/password', authMiddleware, async (req, res) => {
    try {
        const currentPassword = String(req.body?.current_password || '');
        const newPassword = String(req.body?.new_password || '');

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }

        const [userRows] = await pool.query(
            'SELECT user_id, password_h FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const valid = await comparePassword(currentPassword, userRows[0].password_h);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid current password.' });
        }

        const hashed = await hashPassword(newPassword);
        await pool.query('UPDATE users SET password_h = ? WHERE user_id = ?', [hashed, req.user.user_id]);
        return res.json({ message: 'Password updated.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating password', error: err.message });
    }
});

router.post('/delete-account', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const password = String(req.body?.password || '');
        if (!password) {
            return res.status(400).json({ message: 'Password is required to delete account.' });
        }

        const [userRows] = await conn.query(
            'SELECT user_id, password_h FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const valid = await comparePassword(password, userRows[0].password_h);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid password.' });
        }

        await conn.beginTransaction();

        const tables = await conn.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?`,
            [process.env.DB_NAME || 'dragonflydb']
        );
        const tableSet = new Set((tables[0] || []).map((row) => row.TABLE_NAME));

        if (tableSet.has('user_likes')) {
            await conn.query('DELETE FROM user_likes WHERE user_id = ?', [req.user.user_id]);
        }
        if (tableSet.has('playlist_songs') && tableSet.has('playlists')) {
            await conn.query(
                'DELETE ps FROM playlist_songs ps JOIN playlists p ON p.playlist_id = ps.playlist_id WHERE p.user_id = ?',
                [req.user.user_id]
            );
        }
        if (tableSet.has('playlists')) {
            await conn.query('DELETE FROM playlists WHERE user_id = ?', [req.user.user_id]);
        }
        if (tableSet.has('artist_acc')) {
            await conn.query('DELETE FROM artist_acc WHERE user_id = ?', [req.user.user_id]);
        }
        if (tableSet.has('admin_permissions')) {
            await conn.query('DELETE FROM admin_permissions WHERE user_id = ?', [req.user.user_id]);
        }
        await conn.query('DELETE FROM users WHERE user_id = ?', [req.user.user_id]);

        await conn.commit();
        return res.json({ message: 'Account deleted.' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error deleting account', error: err.message });
    } finally {
        conn.release();
    }
});

/* ============================================================
   SUPPORT + EXPORT
   ============================================================ */
router.post('/support', authMiddleware, async (req, res) => {
    try {
        const subject = String(req.body?.subject || '').trim();
        const message = String(req.body?.message || '').trim();
        const email = String(req.body?.email || '').trim();

        if (!subject || !message) {
            return res.status(400).json({ message: 'Subject and message are required.' });
        }

        await ensureSupportTable();
        await pool.query(
            'INSERT INTO support_tickets (user_id, email, subject, message) VALUES (?, ?, ?, ?)',
            [req.user.user_id, email || null, subject, message]
        );

        return res.json({ message: 'Support request submitted.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error submitting support request', error: err.message });
    }
});

router.get('/export', authMiddleware, async (req, res) => {
    try {
        await ensureSettingsTable();
        const [userRows] = await pool.query(
            'SELECT user_id, username, email, bio, accent, avatar_url AS avatarUrl, roles, created_at FROM users WHERE user_id = ?',
            [req.user.user_id]
        );

        const base = defaultSettings();
        const [settingsRows] = await pool.query(
            'SELECT privacy_json, notifications_json, playback_json, artist_json FROM user_settings WHERE user_id = ?',
            [req.user.user_id]
        );
        const settingsRow = settingsRows[0];

        const payload = {
            user: userRows[0] || null,
            settings: settingsRow
                ? {
                    privacy: safeParseJson(settingsRow.privacy_json, base.privacy),
                    notifications: safeParseJson(settingsRow.notifications_json, base.notifications),
                    playback: safeParseJson(settingsRow.playback_json, base.playback),
                    artistTools: safeParseJson(settingsRow.artist_json, base.artistTools)
                }
                : base
        };

        return res.json(payload);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error exporting data', error: err.message });
    }
});

module.exports = router;
