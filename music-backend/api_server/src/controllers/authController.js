// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Register a new user
 * Supports both regular users and artists
 */
async function register(req, res) {
    const conn = await pool.getConnection();

    try {
        const {
            username,
            password,
            email,
            role = 'user',
            artist_name,
            bio,
            country
        } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({
                message: 'Username, password, and email are required'
            });
        }

        // Check if user already exists
        const [existingUsers] = await conn.query(
            'SELECT user_id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                message: 'Username or email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        await conn.beginTransaction();

        // Insert user
        const [userResult] = await conn.query(
            'INSERT INTO users (username, password, email, roles) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, email, role]
        );

        const user_id = userResult.insertId;

        // If artist, create artist profile
        if (role === 'artist') {
            if (!artist_name) {
                await conn.rollback();
                return res.status(400).json({
                    message: 'Artist name is required for artist registration'
                });
            }

            await conn.query(
                'INSERT INTO artist (artist_name, bio, country, user_id) VALUES (?, ?, ?, ?)',
                [artist_name, bio || null, country || null, user_id]
            );

            // Link artist to artist_acc
            await conn.query(
                'INSERT INTO artist_acc (user_id, artist_id) VALUES (?, ?)',
                [user_id, userResult.insertId]
            );
        }

        await conn.commit();

        return res.status(201).json({
            message: 'User registered successfully',
            user_id
        });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({
            message: 'Error registering user',
            error: err.message
        });
    } finally {
        conn.release();
    }
}

/**
 * Login user
 */
async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: 'Username and password are required'
            });
        }

        // Fetch user
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const user = rows[0];

        // If artist, fetch artist_id
        let artist_id = null;

        if (user.roles === 'artist') {
            const [rows] = await pool.query(
                'SELECT artist_id FROM artist_acc WHERE user_id = ?',
                [user.user_id]
            );
            console.log('DEBUG: Fetching artist_id for user:', user.user_id);
            console.log('DEBUG: Artist rows found:', rows);
            if (rows.length > 0) {
                artist_id = rows[0].artist_id;
            }
        }


        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.user_id,
                username: user.username,
                roles: user.roles,
                artist_id: artist_id
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        return res.json({
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                roles: user.roles
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Error logging in',
            error: err.message
        });
    }
}

/**
 * Get current user profile
 */
async function getProfile(req, res) {
    try {
        const user_id = req.user.user_id;

        // Fetch user
        const [userRows] = await pool.query(
            'SELECT user_id, username, email, roles, created_at FROM users WHERE user_id = ?',
            [user_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const user = userRows[0];

        // If artist, fetch artist details
        if (user.roles === 'artist') {
            const [artistRows] = await pool.query(
                'SELECT * FROM artist WHERE user_id = ?',
                [user_id]
            );

            if (artistRows.length > 0) {
                user.artist = artistRows[0];
            }
        }

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Error fetching profile',
            error: err.message
        });
    }
}

module.exports = {
    register,
    login,
    getProfile
};