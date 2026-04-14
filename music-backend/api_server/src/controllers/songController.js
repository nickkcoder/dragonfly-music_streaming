// src/controllers/songController.js
const pool = require('../config/db');

/**
 * Create a new song
 * - Artists upload for themselves
 * - Admins upload on behalf of artists
 */
async function createSong(req, res) {
    const conn = await pool.getConnection();

    try {
        const {
            title,
            file_url,
            album_id,
            genre_id,
            duration_seconds,
            cover_image
        } = req.body;

        if (!title || !file_url) {
            return res.status(400).json({
                message: 'Title and file_url are required'
            });
        }

        await conn.beginTransaction();

        let artist_id;

        // 👑 ADMIN FLOW
        if (req.user.roles === 'admin') {
            if (!req.body.artist_id) {
                await conn.rollback();
                return res.status(400).json({
                    message: 'artist_id is required when admin uploads a song'
                });
            }

            const [artistCheck] = await conn.query(
                'SELECT artist_id FROM artist WHERE artist_id = ?',
                [req.body.artist_id]
            );

            if (artistCheck.length === 0) {
                await conn.rollback();
                return res.status(404).json({
                    message: 'Artist not found'
                });
            }

            artist_id = req.body.artist_id;

            // 🎤 ARTIST FLOW
        } else {
            const [artistRows] = await conn.query(
                'SELECT artist_id FROM artist_acc WHERE user_id = ?',
                [req.user.user_id]
            );

            if (artistRows.length === 0) {
                await conn.rollback();
                return res.status(403).json({
                    message: 'User is not linked to an artist'
                });
            }

            artist_id = artistRows[0].artist_id;
        }

        // Insert song
        const [songResult] = await conn.query(
            `INSERT INTO songs (
                artist_id,
                album_id,
                genre_id,
                title,
                file_url,
                duration_seconds,
                cover_image,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                artist_id,
                album_id || null,
                genre_id || null,
                title,
                file_url,
                duration_seconds || null,
                cover_image || null,
                req.user.user_id
            ]
        );

        await conn.commit();

        return res.status(201).json({
            song_id: songResult.insertId,
            message: 'Song uploaded successfully'
        });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({
            message: 'Error uploading song',
            error: err.message
        });
    } finally {
        conn.release();
    }
}

/**
 * Get song by ID (public)
 */
async function getSong(req, res) {
    try {
        const song_id = req.params.id;

        const [rows] = await pool.query(
            `SELECT s.*, a.artist_name
             FROM songs s
             JOIN Artist a ON s.artist_id = a.artist_id
             WHERE s.song_id = ?`,
            [song_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Song not found' });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Error fetching song',
            error: err.message
        });
    }
}

/**
 * Get songs by artist (public)
 */
async function getSongsByArtist(req, res) {
    try {
        const artist_id = req.params.artistId;

        const [rows] = await pool.query(
            `SELECT * FROM songs
             WHERE artist_id = ?
             ORDER BY uploaded_at DESC`,
            [artist_id]
        );

        return res.json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Error fetching songs',
            error: err.message
        });
    }
}



/**
 * Delete song
 * - Artists can delete their own songs
 * - Admins can delete any song
 */
async function deleteSong(req, res) {
    const conn = await pool.getConnection();

    try {
        const song_id = req.params.id;

        await conn.beginTransaction();

        // Fetch song
        const [songRows] = await conn.query(
            'SELECT song_id, artist_id FROM songs WHERE song_id = ?',
            [song_id]
        );

        if (songRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        const song = songRows[0];

        // 👑 ADMIN: can delete anything
        if (req.user.roles !== 'admin') {
            // 🎤 ARTIST: must own the song
            const [artistRows] = await conn.query(
                'SELECT artist_id FROM artist_acc WHERE user_id = ?',
                [req.user.user_id]
            );

            if (artistRows.length === 0) {
                await conn.rollback();
                return res.status(403).json({
                    message: 'User is not linked to an artist'
                });
            }

            const artist_id = artistRows[0].artist_id;

            if (artist_id !== song.artist_id) {
                await conn.rollback();
                return res.status(403).json({
                    message: 'You do not have permission to delete this song'
                });
            }
        }

        // Delete all child-table references first (FK constraints)
        await conn.query('DELETE FROM user_likes WHERE song_id = ?', [song_id]);
        await conn.query('DELETE FROM playlist_songs WHERE song_id = ?', [song_id]);
        await conn.query('DELETE FROM album_tracks WHERE song_id = ?', [song_id]);

        // user_listening_history may not exist yet on all deployments — ignore if missing
        await conn.query(
            'DELETE FROM user_listening_history WHERE song_id = ?',
            [song_id]
        ).catch(() => {});

        // Now safe to delete the song itself
        await conn.query('DELETE FROM songs WHERE song_id = ?', [song_id]);

        await conn.commit();

        return res.json({
            message: 'Song deleted successfully'
        });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({
            message: 'Error deleting song',
            error: err.message
        });
    } finally {
        conn.release();
    }
}

module.exports = {
    createSong,
    getSong,
    getSongsByArtist,
    deleteSong
};
