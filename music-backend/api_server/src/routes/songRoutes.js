const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const songController = require('../controllers/songController');
const pool = require('../config/db');
const { buildSongSelect } = require('../utils/songQuery');
let ensureAlbumTracksTablePromise = null;
let ensureLikesTablesPromise = null;

async function ensureAlbumTracksTable() {
    if (!ensureAlbumTracksTablePromise) {
        ensureAlbumTracksTablePromise = pool.query(
            `CREATE TABLE IF NOT EXISTS album_tracks (
                album_id INT NOT NULL,
                song_id INT NOT NULL,
                track_number INT NOT NULL,
                PRIMARY KEY (album_id, song_id),
                UNIQUE KEY uq_album_track_number (album_id, track_number),
                INDEX idx_album_tracks_song (song_id)
            )`
        ).catch((err) => {
            ensureAlbumTracksTablePromise = null;
            throw err;
        });
    }

    return ensureAlbumTracksTablePromise;
}

async function ensureLikesTables() {
    if (!ensureLikesTablesPromise) {
        ensureLikesTablesPromise = (async () => {
            await pool.query(
                `CREATE TABLE IF NOT EXISTS user_likes (
                    user_id INT NOT NULL,
                    song_id INT NOT NULL,
                    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, song_id),
                    INDEX idx_user_likes_song (song_id)
                )`
            );
            await pool.query(
                `CREATE TABLE IF NOT EXISTS playlists (
                    playlist_id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    playlist_name VARCHAR(255) NOT NULL,
                    is_public TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_playlists_user (user_id)
                )`
            );
            await pool.query(
                `CREATE TABLE IF NOT EXISTS playlist_songs (
                    playlist_id INT NOT NULL,
                    song_id INT NOT NULL,
                    position INT NOT NULL,
                    PRIMARY KEY (playlist_id, song_id),
                    UNIQUE KEY uq_playlist_position (playlist_id, position),
                    INDEX idx_playlist_songs_song (song_id)
                )`
            );
        })().catch((err) => {
            ensureLikesTablesPromise = null;
            throw err;
        });
    }

    return ensureLikesTablesPromise;
}

// GET ALL SONGS (public)
router.get('/', async (req, res) => {
    try {
        const { selectClause, joins, orderBy } = await buildSongSelect();
        const [rows] = await pool.query(
            `SELECT ${selectClause}
             FROM songs s
             ${joins}
             ORDER BY ${orderBy}`
        );

        return res.json({ songs: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching songs', error: err.message });
    }
});

// GET SONGS BY ARTIST (public)
router.get('/artist/:artistId', songController.getSongsByArtist);

// GET LIKED SONGS (auth)
router.get('/liked', authMiddleware, async (req, res) => {
    try {
        await ensureLikesTables();
        const userId = req.user.user_id;
        const { selectClause, joins, orderBy } = await buildSongSelect();
        const [rows] = await pool.query(
            `SELECT ${selectClause}
             FROM user_likes ul
             JOIN songs s ON s.song_id = ul.song_id
             ${joins}
             WHERE ul.user_id = ?
             ORDER BY ${orderBy}`,
            [userId]
        );

        return res.json({ songs: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching liked songs', error: err.message });
    }
});

async function ensureLikedPlaylist(conn, userId) {
    const [existing] = await conn.query(
        'SELECT playlist_id FROM playlists WHERE user_id = ? AND LOWER(playlist_name) = ? LIMIT 1',
        [userId, 'liked songs']
    );

    if (existing.length > 0) {
        return existing[0].playlist_id;
    }

    const [created] = await conn.query(
        'INSERT INTO playlists (user_id, playlist_name, is_public) VALUES (?, ?, ?)',
        [userId, 'Liked Songs', 0]
    );

    return created.insertId;
}

// LIKE A SONG (auth)
router.post('/:id/like', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await ensureLikesTables();
        const userId = req.user.user_id;
        const songId = Number(req.params.id);

        if (!Number.isInteger(songId) || songId <= 0) {
            return res.status(400).json({ message: 'Valid song id is required' });
        }

        await conn.beginTransaction();

        const [songRows] = await conn.query('SELECT song_id FROM songs WHERE song_id = ?', [songId]);
        if (songRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Song not found' });
        }

        await conn.query(
            'INSERT IGNORE INTO user_likes (user_id, song_id) VALUES (?, ?)',
            [userId, songId]
        );

        const playlistId = await ensureLikedPlaylist(conn, userId);

        const [existingTrack] = await conn.query(
            'SELECT song_id FROM playlist_songs WHERE playlist_id = ? AND song_id = ? LIMIT 1',
            [playlistId, songId]
        );

        if (existingTrack.length === 0) {
            const [maxPositionRows] = await conn.query(
                'SELECT COALESCE(MAX(position), 0) AS max_position FROM playlist_songs WHERE playlist_id = ?',
                [playlistId]
            );
            const nextPos = Number(maxPositionRows[0]?.max_position || 0) + 1;
            await conn.query(
                'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
                [playlistId, songId, nextPos]
            );
        }

        await conn.commit();
        return res.json({ success: true, liked: true, message: 'Song liked' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error liking song', error: err.message });
    } finally {
        conn.release();
    }
});

// UNLIKE A SONG (auth)
router.delete('/:id/like', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await ensureLikesTables();
        const userId = req.user.user_id;
        const songId = Number(req.params.id);

        if (!Number.isInteger(songId) || songId <= 0) {
            return res.status(400).json({ message: 'Valid song id is required' });
        }

        await conn.beginTransaction();

        await conn.query(
            'DELETE FROM user_likes WHERE user_id = ? AND song_id = ?',
            [userId, songId]
        );

        const [playlistRows] = await conn.query(
            'SELECT playlist_id FROM playlists WHERE user_id = ? AND LOWER(playlist_name) = ? LIMIT 1',
            [userId, 'liked songs']
        );

        if (playlistRows.length > 0) {
            await conn.query(
                'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
                [playlistRows[0].playlist_id, songId]
            );
        }

        await conn.commit();
        return res.json({ success: true, liked: false, message: 'Song unliked' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error unliking song', error: err.message });
    } finally {
        conn.release();
    }
});

// CREATE ALBUM WITH TRACK QUEUE (artist or admin)
router.post(
    '/albums',
    authMiddleware,
    requireRole('artist', 'admin'),
    async (req, res) => {
        const conn = await pool.getConnection();
        try {
            await ensureAlbumTracksTable();
            const { artist_id, title, cover_image, release_date, tracks, track_list } = req.body || {};
            const albumTitle = String(title || '').trim();
            const rawTracks = Array.isArray(tracks) ? tracks : (Array.isArray(track_list) ? track_list : []);

            if (!albumTitle) {
                return res.status(400).json({ message: 'Album title is required' });
            }
            if (!rawTracks.length) {
                return res.status(400).json({ message: 'At least one track is required' });
            }

            let artistId = null;
            if (req.user.roles === 'admin') {
                artistId = Number(artist_id);
                if (!Number.isInteger(artistId) || artistId <= 0) {
                    return res.status(400).json({ message: 'Valid artist_id is required for admin album creation' });
                }
            } else {
                const [artistAccRows] = await conn.query(
                    'SELECT artist_id FROM artist_acc WHERE user_id = ? LIMIT 1',
                    [req.user.user_id]
                );
                if (artistAccRows.length === 0) {
                    return res.status(403).json({ message: 'User is not linked to an artist' });
                }
                artistId = Number(artistAccRows[0].artist_id);
            }

            const normalizedTracks = rawTracks.map((track, index) => {
                const rawSongId = Number(track?.song_id ?? track?.id);
                const trackNumber = Number(track?.order_number ?? track?.track_number ?? track?.position ?? (index + 1));
                const newTitle = String(track?.title || '').trim();
                const newFileUrl = String(track?.file_url || '').trim();

                return {
                    song_id: Number.isInteger(rawSongId) && rawSongId > 0 ? rawSongId : null,
                    track_number: trackNumber,
                    is_new: !!(!rawSongId && newTitle && newFileUrl),
                    title: newTitle,
                    file_url: newFileUrl,
                    genre_id: track?.genre_id ? Number(track.genre_id) : null,
                    duration_seconds: track?.duration_seconds ? Number(track.duration_seconds) : null
                };
            });

            const hasInvalidTrack = normalizedTracks.some((track) => {
                const validExisting = !!track.song_id;
                const validNew = track.is_new && !!track.title && !!track.file_url;
                return !validExisting && !validNew;
            });
            if (hasInvalidTrack) {
                return res.status(400).json({
                    message: 'Each track must provide either song_id or new track data (title + file_url).'
                });
            }

            if (normalizedTracks.some((track) => !Number.isInteger(track.track_number) || track.track_number <= 0)) {
                return res.status(400).json({ message: 'Each track requires a valid positive order number' });
            }

            const trackNumbers = normalizedTracks.map((track) => track.track_number);
            const uniqueTrackNumbers = Array.from(new Set(trackNumbers));
            if (uniqueTrackNumbers.length !== trackNumbers.length) {
                return res.status(400).json({ message: 'Track order numbers must be unique' });
            }

            const existingSongIds = normalizedTracks.filter((track) => !!track.song_id).map((track) => track.song_id);
            const uniqueSongIds = Array.from(new Set(existingSongIds));
            if (uniqueSongIds.length !== existingSongIds.length) {
                return res.status(400).json({ message: 'Track list contains duplicate existing song IDs' });
            }

            await conn.beginTransaction();

            const [artistRows] = await conn.query('SELECT artist_id FROM artist WHERE artist_id = ?', [artistId]);
            if (artistRows.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Artist not found' });
            }

            if (uniqueSongIds.length > 0) {
                const placeholders = uniqueSongIds.map(() => '?').join(',');
                const [songRows] = await conn.query(
                    `SELECT song_id, artist_id FROM songs WHERE song_id IN (${placeholders})`,
                    uniqueSongIds
                );
                if (songRows.length !== uniqueSongIds.length) {
                    await conn.rollback();
                    return res.status(400).json({ message: 'One or more existing songs were not found' });
                }
                const songById = new Map(songRows.map((song) => [Number(song.song_id), Number(song.artist_id)]));
                for (const track of normalizedTracks) {
                    if (track.song_id && songById.get(track.song_id) !== artistId) {
                        await conn.rollback();
                        return res.status(400).json({ message: 'All songs in an album must belong to the same artist' });
                    }
                }
            }

            const normalizedReleaseDate = release_date ? String(release_date).slice(0, 10) : null;
            const [albumResult] = await conn.query(
                'INSERT INTO albums (artist_id, title, cover_image, release_date) VALUES (?, ?, ?, ?)',
                [artistId, albumTitle, cover_image || null, normalizedReleaseDate]
            );
            const albumId = Number(albumResult.insertId);

            const finalTrackRows = [];
            for (const track of normalizedTracks) {
                let finalSongId = track.song_id;
                if (!finalSongId && track.is_new) {
                    const [newSongResult] = await conn.query(
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
                            artistId,
                            albumId,
                            Number.isInteger(track.genre_id) ? track.genre_id : null,
                            track.title,
                            track.file_url,
                            Number.isInteger(track.duration_seconds) ? track.duration_seconds : null,
                            cover_image || null,
                            req.user.user_id
                        ]
                    );
                    finalSongId = Number(newSongResult.insertId);
                }

                finalTrackRows.push({ song_id: finalSongId, track_number: track.track_number });
                await conn.query(
                    'INSERT INTO album_tracks (album_id, song_id, track_number) VALUES (?, ?, ?)',
                    [albumId, finalSongId, track.track_number]
                );
            }

            if (uniqueSongIds.length > 0) {
                const placeholders = uniqueSongIds.map(() => '?').join(',');
                await conn.query(
                    `UPDATE songs SET album_id = ? WHERE song_id IN (${placeholders})`,
                    [albumId, ...uniqueSongIds]
                );
            }

            await conn.commit();
            return res.status(201).json({
                success: true,
                album_id: albumId,
                tracks_added: finalTrackRows.length,
                tracks: finalTrackRows,
                message: 'Album created successfully'
            });
        } catch (err) {
            await conn.rollback();
            console.error(err);
            return res.status(500).json({ message: 'Error creating album', error: err.message });
        } finally {
            conn.release();
        }
    }
);

// GET TRENDING SONGS — ranked by total likes across all users (public)
router.get('/trending', async (req, res) => {
    try {
        await ensureLikesTables();
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const { selectClause, joins } = await buildSongSelect();

        // Primary: songs ordered by total like count descending
        const [rows] = await pool.query(
            `SELECT ${selectClause},
                    COUNT(ul.song_id) AS like_count
             FROM songs s
             ${joins}
             LEFT JOIN user_likes ul ON ul.song_id = s.song_id
             GROUP BY s.song_id
             ORDER BY like_count DESC, s.uploaded_at DESC
             LIMIT ?`,
            [limit]
        );

        // If no likes exist yet, fall back to newest uploads
        if (rows.length === 0) {
            const { selectClause: sc2, joins: j2, orderBy } = await buildSongSelect();
            const [fallback] = await pool.query(
                `SELECT ${sc2}, 0 AS like_count
                 FROM songs s
                 ${j2}
                 ORDER BY ${orderBy} DESC
                 LIMIT ?`,
                [limit]
            );
            return res.json({ songs: fallback, source: 'newest' });
        }

        return res.json({ songs: rows, source: 'likes' });
    } catch (err) {
        console.error('[trending]', err);
        return res.status(500).json({ message: 'Error fetching trending songs', error: err.message });
    }
});

// RECORD A PLAY EVENT (auth, optional — fails silently)
router.post('/:id/play', authMiddleware, async (req, res) => {
    try {
        const songId = Number(req.params.id);
        const userId = req.user?.user_id;

        if (!Number.isInteger(songId) || songId <= 0 || !userId) {
            return res.status(400).json({ message: 'Invalid song or user' });
        }

        await pool.query(
            `CREATE TABLE IF NOT EXISTS user_listening_history (
                history_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                song_id INT NOT NULL,
                listened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ulh_song (song_id),
                INDEX idx_ulh_user (user_id)
            )`
        );

        await pool.query(
            'INSERT INTO user_listening_history (user_id, song_id) VALUES (?, ?)',
            [userId, songId]
        );

        return res.json({ success: true });
    } catch (err) {
        console.error('[play]', err);
        return res.status(500).json({ message: 'Error recording play', error: err.message });
    }
});

// GET SONG BY ID (public)
router.get('/:id', songController.getSong);


// CREATE SONG (artist or admin)
router.post(
    '/',
    authMiddleware,
    requireRole('artist', 'admin'),
    songController.createSong
);

// DELETE SONG (artist or admin)
router.delete(
    '/:id',
    authMiddleware,
    requireRole('artist', 'admin'),
    songController.deleteSong
);

module.exports = router;
