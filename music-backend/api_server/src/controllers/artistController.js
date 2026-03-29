// src/controllers/artistController.js
const pool = require('../config/db');

let _artistGenreColumnEnsured = false;
async function ensureArtistGenreColumn() {
    if (_artistGenreColumnEnsured) return;
    const dbName = process.env.DB_NAME || 'dragonflydb';
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'artist' AND COLUMN_NAME = 'genre'`,
        [dbName]
    );
    if (cols.length === 0) {
        await pool.query('ALTER TABLE artist ADD COLUMN genre VARCHAR(100) NULL');
    }
    _artistGenreColumnEnsured = true;
}

/**
 * Create a new artist profile and link to the user
 * - Requires auth
 * - Updates user role to 'artist'
 */
async function createArtist(req, res) {
    const conn = await pool.getConnection();
    try {
        const { artist_name, bio, img_url, genre } = req.body;

        if (!artist_name) {
            return res.status(400).json({ message: 'Artist name is required' });
        }

        await conn.beginTransaction();

        await ensureArtistGenreColumn();

        const [existing] = await conn.query(
            'SELECT artist_id FROM artist_acc WHERE user_id = ?',
            [req.user.user_id]
        );

        if (existing.length > 0) {
            await conn.rollback();
            return res.status(400).json({
                message: 'User already has an artist profile'
            });
        }

        const [artistResult] = await conn.query(
            'INSERT INTO artist (artist_name, bio, genre, img_url, verified) VALUES (?, ?, ?, ?, ?)',
            [artist_name, bio || null, genre || null, img_url || null, false]
        );
        const artist_id = artistResult.insertId;

        await conn.query(
            'INSERT INTO artist_acc (user_id, artist_id) VALUES (?, ?)',
            [req.user.user_id, artist_id]
        );

        await conn.query(
            'UPDATE Users SET roles = ? WHERE user_id = ?',
            ['artist', req.user.user_id]
        );

        await conn.commit();

        return res.status(201).json({ artist_id, message: 'Artist profile created successfully' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error creating artist', error: err.message });
    } finally {
        conn.release();
    }
}

async function getArtistIdByUser(userId) {
    return pool.query(
        'SELECT artist_id FROM artist_acc WHERE user_id = ? LIMIT 1',
        [userId]
    );
}

/**
 * Get artist by ID
 */
async function getArtist(req, res) {
    try {
        const artist_id = req.params.id;
        const [rows] = await pool.query(
            'SELECT * FROM artist WHERE artist_id = ?',
            [artist_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching artist', error: err.message });
    }
}

/**
 * Get catalog by artist with albums, singles, and ordered tracklists
 */
async function getArtistCatalog(req, res) {
    try {
        const artistId = parseInt(req.params.id, 10);
        if (isNaN(artistId) || artistId <= 0) {
            return res.status(400).json({ message: 'Valid numeric artist id is required' });
        }

        const [artistRows] = await pool.query(
            'SELECT * FROM artist WHERE artist_id = ?',
            [artistId]
        );

        if (artistRows.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        const [albumRows] = await pool.query(
            `SELECT
                al.album_id,
                al.title,
                al.cover_image,
                al.release_date,
                s.song_id,
                s.title AS song_title,
                s.file_url,
                s.cover_image AS song_cover_image,
                s.uploaded_at,
                ROW_NUMBER() OVER (PARTITION BY al.album_id ORDER BY s.song_id) AS track_number
             FROM albums al
             LEFT JOIN songs s ON s.album_id = al.album_id
             WHERE al.artist_id = ?
             ORDER BY al.release_date DESC, al.album_id DESC, s.song_id ASC`,
            [artistId]
        );

        const albumMap = new Map();
        for (const row of albumRows) {
            if (!albumMap.has(row.album_id)) {
                albumMap.set(row.album_id, {
                    album_id: row.album_id,
                    title: row.title,
                    cover_image: row.cover_image,
                    release_date: row.release_date,
                    tracks: []
                });
            }

            if (row.song_id) {
                albumMap.get(row.album_id).tracks.push({
                    song_id: row.song_id,
                    title: row.song_title,
                    file_url: row.file_url,
                    cover_image: row.song_cover_image || row.cover_image || null,
                    track_number: row.track_number,
                    uploaded_at: row.uploaded_at
                });
            }
        }

        const [singleRows] = await pool.query(
            `SELECT
                s.song_id,
                s.title,
                s.file_url,
                s.cover_image,
                s.uploaded_at,
                s.genre_id
             FROM songs s
             WHERE s.artist_id = ? AND (s.album_id IS NULL OR s.album_id = 0)
             ORDER BY s.uploaded_at DESC`,
            [artistId]
        );

        return res.json({
            artist: artistRows[0],
            albums: Array.from(albumMap.values()),
            singles: singleRows
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching artist catalog', error: err.message });
    }
}

/**
 * Get all artists (optional: add pagination later)
 */
async function getAllArtists(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM artist ORDER BY created_at DESC');
        return res.json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching artists', error: err.message });
    }
}

/**
 * Admin-only: verify an artist
 */
async function verifyArtist(req, res) {
    try {
        const artist_id = req.params.id;

        const [result] = await pool.query(
            'UPDATE artist SET verified = ? WHERE artist_id = ?',
            [true, artist_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        return res.json({ message: 'Artist verified successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error verifying artist', error: err.message });
    }
}

module.exports = {
    createArtist,
    getArtistIdByUser,
    getArtist,
    getArtistCatalog,
    getAllArtists,
    verifyArtist
};
