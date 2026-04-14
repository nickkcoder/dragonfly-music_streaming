const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const songController = require('../controllers/songController');
const { buildSongSelect } = require('../utils/songQuery');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const UNDO_WINDOW_MINUTES = 10;
let ensureDeletionTablePromise = null;
let ensureAlbumTracksTablePromise = null;

async function ensureDeletionTable() {
    if (!ensureDeletionTablePromise) {
        ensureDeletionTablePromise = pool.query(
            `CREATE TABLE IF NOT EXISTS deleted_entities (
                deletion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                entity_type VARCHAR(40) NOT NULL,
                entity_id INT NOT NULL,
                payload LONGTEXT NOT NULL,
                deleted_by INT NULL,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                restored_at DATETIME NULL,
                INDEX idx_deleted_active (restored_at, expires_at),
                INDEX idx_deleted_type_id (entity_type, entity_id)
            )`
        ).catch((err) => {
            ensureDeletionTablePromise = null;
            throw err;
        });
    }

    return ensureDeletionTablePromise;
}

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

function normalizeRole(value) {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'a' || role === 'adm' || role === 'administrator' || role === '1') return 'admin';
    if (role === 'ar' || role === 'art' || role === '2') return 'artist';
    if (role === 'u' || role === 'usr' || role === '3') return 'user';
    return role;
}

function extractRequestedRole(req) {
    const body = req.body || {};
    return normalizeRole(
        body.role ??
        body.user_role ??
        body.role_name ??
        body.role_code ??
        body.account_type ??
        body.type ??
        body.permission ??
        body.role_id
    );
}

function parsePayload(payloadText) {
    try {
        return JSON.parse(payloadText);
    } catch {
        return null;
    }
}

function toMySqlDateTime(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    // MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function recordDeletion(conn, { entityType, entityId, payload, deletedBy }) {
    await ensureDeletionTable();
    await conn.query(
        `INSERT INTO deleted_entities (entity_type, entity_id, payload, deleted_by, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [entityType, entityId, JSON.stringify(payload), deletedBy || null, UNDO_WINDOW_MINUTES]
    );
}

async function restoreUser(conn, payload) {
    if (!payload?.user?.user_id) {
        throw new Error('Invalid user payload');
    }

    const user = payload.user;
    const [exists] = await conn.query('SELECT user_id FROM users WHERE user_id = ?', [user.user_id]);
    if (exists.length > 0) {
        throw new Error('Cannot restore user: user_id already exists');
    }

    await conn.query(
        `INSERT INTO users (user_id, username, email, password_h, profile_pic, created_at, roles)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            user.user_id,
            user.username,
            user.email,
            user.password_h,
            user.profile_pic || null,
            toMySqlDateTime(user.created_at),
            user.roles
        ]
    );

    if (Array.isArray(payload.artist_acc) && payload.artist_acc.length > 0) {
        for (const row of payload.artist_acc) {
            await conn.query(
                'INSERT IGNORE INTO artist_acc (user_id, artist_id) VALUES (?, ?)',
                [row.user_id, row.artist_id]
            );
        }
    }

    if (Array.isArray(payload.admin_permissions) && payload.admin_permissions.length > 0) {
        for (const row of payload.admin_permissions) {
            await conn.query(
                `INSERT INTO admin_permissions (user_id, can_upload, can_edit_artists, can_delete_songs)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    can_upload = VALUES(can_upload),
                    can_edit_artists = VALUES(can_edit_artists),
                    can_delete_songs = VALUES(can_delete_songs)`,
                [row.user_id, !!row.can_upload, !!row.can_edit_artists, !!row.can_delete_songs]
            );
        }
    }
}

async function restoreArtistBundle(conn, payload) {
    if (!payload?.artist?.artist_id) {
        throw new Error('Invalid artist payload');
    }

    const artist = payload.artist;
    const [artistExists] = await conn.query('SELECT artist_id FROM artist WHERE artist_id = ?', [artist.artist_id]);
    if (artistExists.length > 0) {
        throw new Error('Cannot restore artist: artist_id already exists');
    }

    await conn.query(
        `INSERT INTO artist (artist_id, artist_name, bio, img_url, verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            artist.artist_id,
            artist.artist_name,
            artist.bio || null,
            artist.img_url || null,
            !!artist.verified,
            toMySqlDateTime(artist.created_at)
        ]
    );

    if (Array.isArray(payload.artist_acc) && payload.artist_acc.length > 0) {
        for (const row of payload.artist_acc) {
            await conn.query(
                'INSERT IGNORE INTO artist_acc (user_id, artist_id) VALUES (?, ?)',
                [row.user_id, row.artist_id]
            );
        }
    }

    if (Array.isArray(payload.songs) && payload.songs.length > 0) {
        for (const song of payload.songs) {
            const [songExists] = await conn.query('SELECT song_id FROM songs WHERE song_id = ?', [song.song_id]);
            if (songExists.length === 0) {
                await conn.query(
                    `INSERT INTO songs (
                        song_id, artist_id, album_id, genre_id, title, file_url,
                        duration_seconds, cover_image, uploaded_by, uploaded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        song.song_id,
                        song.artist_id,
                        song.album_id || null,
                        song.genre_id || null,
                        song.title,
                        song.file_url,
                        song.duration_seconds || null,
                        song.cover_image || null,
                        song.uploaded_by || null,
                        toMySqlDateTime(song.uploaded_at)
                    ]
                );
            }
        }
    }
}

async function restoreSong(conn, payload) {
    if (!payload?.song?.song_id) {
        throw new Error('Invalid song payload');
    }

    const song = payload.song;
    const [exists] = await conn.query('SELECT song_id FROM songs WHERE song_id = ?', [song.song_id]);
    if (exists.length > 0) {
        throw new Error('Cannot restore song: song_id already exists');
    }

    await conn.query(
        `INSERT INTO songs (
            song_id, artist_id, album_id, genre_id, title, file_url,
            duration_seconds, cover_image, uploaded_by, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            song.song_id,
            song.artist_id,
            song.album_id || null,
            song.genre_id || null,
            song.title,
            song.file_url,
            song.duration_seconds || null,
            song.cover_image || null,
            song.uploaded_by || null,
            toMySqlDateTime(song.uploaded_at)
        ]
    );
}

// List recent deletions (admin)
router.get('/deletions', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        await ensureDeletionTable();
        const [rows] = await pool.query(
            `SELECT deletion_id, entity_type, entity_id, deleted_by, deleted_at, expires_at,
                    TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds
             FROM deleted_entities
             WHERE restored_at IS NULL AND expires_at > NOW()
             ORDER BY deleted_at DESC
             LIMIT 200`
        );

        return res.json({ deletions: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching deletions', error: err.message });
    }
});

// Undo deletion (admin)
router.post('/deletions/:deletion_id/undo', authMiddleware, requireRole('admin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await ensureDeletionTable();
        const deletionId = req.params.deletion_id;

        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM deleted_entities
             WHERE deletion_id = ?
               AND restored_at IS NULL
             FOR UPDATE`,
            [deletionId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Deletion record not found or already restored' });
        }

        const record = rows[0];
        const remainingSeconds = Math.floor((new Date(record.expires_at).getTime() - Date.now()) / 1000);
        if (remainingSeconds <= 0) {
            await conn.rollback();
            return res.status(410).json({ message: 'Undo window expired (10 minutes)' });
        }

        const payload = parsePayload(record.payload);
        if (!payload) {
            await conn.rollback();
            return res.status(500).json({ message: 'Invalid deletion payload' });
        }

        if (record.entity_type === 'user') {
            await restoreUser(conn, payload);
        } else if (record.entity_type === 'artist_bundle') {
            await restoreArtistBundle(conn, payload);
        } else if (record.entity_type === 'song') {
            await restoreSong(conn, payload);
        } else {
            throw new Error(`Unsupported entity type: ${record.entity_type}`);
        }

        await conn.query(
            'UPDATE deleted_entities SET restored_at = NOW() WHERE deletion_id = ?',
            [deletionId]
        );

        await conn.commit();

        return res.json({
            success: true,
            message: 'Deletion successfully undone',
            deletion_id: record.deletion_id,
            entity_type: record.entity_type,
            entity_id: record.entity_id
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error undoing deletion', error: err.message });
    } finally {
        conn.release();
    }
});

// List users (admin)
router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const requestedRole = normalizeRole(req.query.role);
        let query = 'SELECT user_id, username, email, roles, created_at FROM users';
        const params = [];

        if (requestedRole) {
            query += ' WHERE LOWER(roles) = ?';
            params.push(requestedRole);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        return res.json({ users: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching users', error: err.message });
    }
});

// List admins (admin)
router.get('/admins', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id, username, email, roles, created_at
             FROM users
             WHERE LOWER(roles) = 'admin'
             ORDER BY created_at DESC`
        );

        return res.json({ admins: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching admins', error: err.message });
    }
});

async function updateUserRoleHandler(req, res) {
    try {
        const user_id = req.params.user_id;
        const role = extractRequestedRole(req);
        const allowedRoles = new Set(['user', 'artist', 'admin']);

        if (!role || !allowedRoles.has(role)) {
            return res.status(400).json({ message: 'Invalid role. Allowed: user, artist, admin' });
        }

        const [result] = await pool.query(
            'UPDATE users SET roles = ? WHERE user_id = ?',
            [role, user_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ success: true, message: 'User role updated', role });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating role', error: err.message });
    }
}

// Update user role (admin) - main + fallback aliases used by frontend
router.put('/users/:user_id/role', authMiddleware, requireRole('admin'), updateUserRoleHandler);
router.post('/users/:user_id/role', authMiddleware, requireRole('admin'), updateUserRoleHandler);
router.put('/users/:user_id', authMiddleware, requireRole('admin'), updateUserRoleHandler);

// Delete user (admin)
router.delete('/users/:user_id', authMiddleware, requireRole('admin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const user_id = req.params.user_id;
        await conn.beginTransaction();

        const [users] = await conn.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
        if (users.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        const [artistAccRows] = await conn.query('SELECT * FROM artist_acc WHERE user_id = ?', [user_id]);
        const [permRows] = await conn.query('SELECT * FROM admin_permissions WHERE user_id = ?', [user_id]);

        await recordDeletion(conn, {
            entityType: 'user',
            entityId: Number(user_id),
            deletedBy: req.user.user_id,
            payload: {
                user: users[0],
                artist_acc: artistAccRows,
                admin_permissions: permRows
            }
        });

        await conn.query('DELETE FROM artist_acc WHERE user_id = ?', [user_id]);
        await conn.query('DELETE FROM admin_permissions WHERE user_id = ?', [user_id]);

        const [result] = await conn.query('DELETE FROM users WHERE user_id = ?', [user_id]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        await conn.commit();
        return res.json({ success: true, message: 'User deleted', undo_window_minutes: UNDO_WINDOW_MINUTES });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error deleting user', error: err.message });
    } finally {
        conn.release();
    }
});

// List artists (admin)
router.get('/artists', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.*, aa.user_id, u.username, u.email
             FROM artist a
             LEFT JOIN artist_acc aa ON aa.artist_id = a.artist_id
             LEFT JOIN users u ON u.user_id = aa.user_id
             ORDER BY a.created_at DESC`
        );
        return res.json({ artists: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching artists', error: err.message });
    }
});

// Create artist profile directly (admin)
let artistGenreColumnEnsured = false;

async function ensureArtistGenreColumn() {
    if (artistGenreColumnEnsured) return;
    const dbName = process.env.DB_NAME || 'dragonflydb';
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Artist'
           AND COLUMN_NAME = 'genre'`,
        [dbName]
    );
    if (cols.length === 0) {
        await pool.query('ALTER TABLE Artist ADD COLUMN genre VARCHAR(100) NULL');
    }
    artistGenreColumnEnsured = true;
}

router.post('/artists', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const { artist_name, bio, img_url, genre } = req.body || {};

        if (!artist_name || !String(artist_name).trim()) {
            return res.status(400).json({ message: 'Artist name is required' });
        }

        await ensureArtistGenreColumn();

        const [result] = await pool.query(
            'INSERT INTO artist (artist_name, bio, genre, img_url, verified) VALUES (?, ?, ?, ?, ?)',
            [String(artist_name).trim(), bio || null, genre || null, img_url || null, false]
        );

        return res.status(201).json({
            artist_id: result.insertId,
            message: 'Artist created successfully'
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error creating artist', error: err.message });
    }
});

// UPDATE artist profile image (admin)
router.put('/artists/:artist_id/image', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const artist_id = req.params.artist_id;
        const imgUrl = String(req.body?.img_url || '').trim();

        if (!imgUrl) {
            return res.status(400).json({ message: 'img_url is required' });
        }

        const [result] = await pool.query(
            'UPDATE artist SET img_url = ? WHERE artist_id = ?',
            [imgUrl, artist_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        return res.json({ success: true, message: 'Artist image updated', img_url: imgUrl });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating artist image', error: err.message });
    }
});

// Delete artist and all their songs (admin)
router.delete('/artists/:artist_id', authMiddleware, requireRole('admin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const artist_id = req.params.artist_id;
        await conn.beginTransaction();

        const [artistRows] = await conn.query('SELECT * FROM artist WHERE artist_id = ?', [artist_id]);
        if (artistRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Artist not found' });
        }

        const [artistAccRows] = await conn.query('SELECT * FROM artist_acc WHERE artist_id = ?', [artist_id]);
        const [songRows] = await conn.query('SELECT * FROM songs WHERE artist_id = ?', [artist_id]);

        await recordDeletion(conn, {
            entityType: 'artist_bundle',
            entityId: Number(artist_id),
            deletedBy: req.user.user_id,
            payload: {
                artist: artistRows[0],
                artist_acc: artistAccRows,
                songs: songRows
            }
        });

        // Clear FK refs for every song belonging to this artist before deleting
        if (songRows.length > 0) {
            const songIds = songRows.map((s) => s.song_id);
            const placeholders = songIds.map(() => '?').join(',');
            await conn.query(`DELETE FROM user_likes WHERE song_id IN (${placeholders})`, songIds);
            await conn.query(`DELETE FROM playlist_songs WHERE song_id IN (${placeholders})`, songIds);
            await conn.query(`DELETE FROM album_tracks WHERE song_id IN (${placeholders})`, songIds);
            await conn.query(`DELETE FROM user_listening_history WHERE song_id IN (${placeholders})`, songIds).catch(() => {});
        }

        await conn.query('DELETE FROM songs WHERE artist_id = ?', [artist_id]);
        await conn.query('DELETE FROM artist_acc WHERE artist_id = ?', [artist_id]);
        await conn.query('DELETE FROM artist WHERE artist_id = ?', [artist_id]);

        await conn.commit();
        return res.json({ success: true, message: 'Artist deleted', undo_window_minutes: UNDO_WINDOW_MINUTES });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error deleting artist', error: err.message });
    } finally {
        conn.release();
    }
});

// List songs (admin)
router.get('/songs', authMiddleware, requireRole('admin'), async (req, res) => {
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

// Create song as admin
router.post('/songs', authMiddleware, requireRole('admin'), songController.createSong);

// Create album with ordered songs as tracks (admin)
router.post('/albums', authMiddleware, requireRole('admin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await ensureAlbumTracksTable();
        const {
            artist_id,
            title,
            cover_image,
            release_date,
            tracks,
            track_list
        } = req.body || {};

        const artistId = Number(artist_id);
        const albumTitle = String(title || '').trim();
        const rawTracks = Array.isArray(tracks) ? tracks : (Array.isArray(track_list) ? track_list : []);

        if (!Number.isInteger(artistId) || artistId <= 0) {
            return res.status(400).json({ message: 'Valid artist_id is required' });
        }

        if (!albumTitle) {
            return res.status(400).json({ message: 'Album title is required' });
        }

        if (!rawTracks.length) {
            return res.status(400).json({ message: 'At least one song is required for album creation' });
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
                duration_seconds: track?.duration_seconds ? Number(track.duration_seconds) : null,
                cover_image: track?.cover_image ? String(track.cover_image).trim() : null
            };
        });

        const hasInvalidTrack = normalizedTracks.some((track) => {
            const validExisting = !!track.song_id;
            const validNew = track.is_new && !!track.title && !!track.file_url;
            return !validExisting && !validNew;
        });

        if (hasInvalidTrack) {
            return res.status(400).json({
                message: 'Each track must provide either an existing song_id or new track data (title + file_url).'
            });
        }

        if (normalizedTracks.some((track) => !Number.isInteger(track.track_number) || track.track_number <= 0)) {
            return res.status(400).json({ message: 'Each track requires a valid positive order number' });
        }

        const songIds = normalizedTracks.filter((track) => !!track.song_id).map((track) => track.song_id);
        const uniqueSongIds = Array.from(new Set(songIds));
        const duplicateSongIds = uniqueSongIds.length !== songIds.length;
        if (duplicateSongIds) {
            return res.status(400).json({ message: 'Song list contains duplicates' });
        }

        const trackNumbers = normalizedTracks.map((track) => track.track_number);
        const uniqueTrackNumbers = Array.from(new Set(trackNumbers));
        const duplicateTrackNumbers = uniqueTrackNumbers.length !== trackNumbers.length;
        if (duplicateTrackNumbers) {
            return res.status(400).json({ message: 'Track order numbers must be unique' });
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
                    return res.status(400).json({ message: 'All songs in an album must belong to the selected artist' });
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
                        track.cover_image || null,
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
                `UPDATE songs
                 SET album_id = ?
                 WHERE song_id IN (${placeholders})`,
                [albumId, ...uniqueSongIds]
            );
        }

        await conn.commit();
        return res.status(201).json({
            success: true,
            album_id: albumId,
            tracks_added: normalizedTracks.length,
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
});

// Delete song as admin (with undo support)
router.delete('/songs/:id', authMiddleware, requireRole('admin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const songId = req.params.id;
        await conn.beginTransaction();

        const [songRows] = await conn.query('SELECT * FROM songs WHERE song_id = ?', [songId]);
        if (songRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Song not found' });
        }

        await recordDeletion(conn, {
            entityType: 'song',
            entityId: Number(songId),
            deletedBy: req.user.user_id,
            payload: { song: songRows[0] }
        });

        // Clear FK child refs before deleting the song
        await conn.query('DELETE FROM user_likes WHERE song_id = ?', [songId]);
        await conn.query('DELETE FROM playlist_songs WHERE song_id = ?', [songId]);
        await conn.query('DELETE FROM album_tracks WHERE song_id = ?', [songId]);
        await conn.query('DELETE FROM user_listening_history WHERE song_id = ?', [songId]).catch(() => {});

        await conn.query('DELETE FROM songs WHERE song_id = ?', [songId]);

        await conn.commit();
        return res.json({ success: true, message: 'Song deleted', undo_window_minutes: UNDO_WINDOW_MINUTES });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Error deleting song', error: err.message });
    } finally {
        conn.release();
    }
});

// Verify artist (admin)
router.post('/verify-artist/:artist_id', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const artist_id = req.params.artist_id;

        await pool.query('UPDATE artist SET verified = ? WHERE artist_id = ?', [true, artist_id]);

        const [linked] = await pool.query(
            'SELECT user_id FROM artist_acc WHERE artist_id = ?',
            [artist_id]
        );

        if (linked.length > 0) {
            const user_id = linked[0].user_id;

            await pool.query(
                `INSERT INTO admin_permissions (user_id, can_upload, can_edit_artists, can_delete_songs)
                 VALUES (?, TRUE, FALSE, FALSE)
                 ON DUPLICATE KEY UPDATE can_upload = TRUE`,
                [user_id]
            );
        }

        return res.json({ success: true, message: 'Artist verified successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error verifying artist', error: err.message });
    }
});

// Create short-lived upload token (admin)
router.post('/create-upload-token', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const { artist_id, ttl_seconds } = req.body || {};

        const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET || 'upload-secret';
        const ttl = ttl_seconds || 300;

        const payload = {
            jti: uuid.v4(),
            user_id: req.user.user_id,
            artist_id: artist_id || null
        };

        const token = jwt.sign(payload, UPLOAD_TOKEN_SECRET, { expiresIn: ttl });
        return res.json({ upload_token: token, ttl_seconds: ttl });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error creating upload token', error: err.message });
    }
});

// Promote user to admin (admin)
router.post('/promote-user/:user_id', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
        const user_id = req.params.user_id;

        const [result] = await pool.query(
            'UPDATE users SET roles = ? WHERE user_id = ?',
            ['admin', user_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ success: true, message: `User ${user_id} promoted to admin` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error promoting user', error: err.message });
    }
});

module.exports = router;
