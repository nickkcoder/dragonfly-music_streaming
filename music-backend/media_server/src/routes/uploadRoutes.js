const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// DB pool for artist_id lookup fallback
const pool = require('../config/db');

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_AUDIO_MIME_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/mp4'
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
]);

/**
 * Resolve artist_id for the request.
 * - Admins: must supply artist_id in body/query.
 * - Artists: prefer JWT artist_id, then fall back to DB lookup.
 *   The DB fallback handles users who became artists after their
 *   current JWT was issued (so their token still lacks artist_id).
 */
async function getArtistId(req) {
    const fromBody  = String(req.body?.artist_id  || '').trim();
    const fromQuery = String(req.query?.artist_id || '').trim();

    if (req.user.roles === 'admin') {
        const artistId = fromBody || fromQuery;
        return /^\d+$/.test(artistId) ? artistId : null;
    }

    // Fast path: artist_id is embedded in JWT
    const fromToken = String(req.user.artist_id || '').trim();
    if (/^\d+$/.test(fromToken)) {
        return fromToken;
    }

    // Slow path: look up artist_acc in DB (token predates the role change)
    if (pool) {
        try {
            const [rows] = await pool.query(
                'SELECT artist_id FROM artist_acc WHERE user_id = ? LIMIT 1',
                [req.user.user_id]
            );
            if (rows.length > 0) {
                return String(rows[0].artist_id);
            }
        } catch (_) { /* ignore db errors, fall through */ }
    }

    // Last resort: accept artist_id passed explicitly in the request body/query
    const explicit = fromBody || fromQuery;
    return /^\d+$/.test(explicit) ? explicit : null;
}

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        try {
            const artist_id = await getArtistId(req);
            if (!artist_id) {
                return cb(new Error('Valid artist_id is required'));
            }
            const uploadPath = path.join(__dirname, '../../uploads', `artist_${artist_id}`);
            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('Only audio files are allowed'));
        }
        cb(null, true);
    }
});

const imageUpload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

router.post(
    '/song',
    authMiddleware,
    requireRole('artist', 'admin'),
    (req, res) => {
        upload.single('file')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'File is too large. Maximum size is 20MB' });
                }
                return res.status(400).json({ message: err.message });
            }
            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const artist_id = await getArtistId(req);
            if (!artist_id) {
                return res.status(400).json({ message: 'Valid artist_id is required' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded. Use field name "file"' });
            }

            res.status(201).json({
                message: 'File uploaded successfully',
                file_url: `/uploads/artist_${artist_id}/${req.file.filename}`
            });
        });
    }
);

router.post(
    '/image',
    authMiddleware,
    requireRole('artist', 'admin'),
    (req, res) => {
        imageUpload.single('file')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'Image is too large. Maximum size is 8MB' });
                }
                return res.status(400).json({ message: err.message });
            }
            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const artist_id = await getArtistId(req);
            if (!artist_id) {
                return res.status(400).json({ message: 'Valid artist_id is required' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded. Use field name "file"' });
            }

            res.status(201).json({
                message: 'Image uploaded successfully',
                file_url: `/uploads/artist_${artist_id}/${req.file.filename}`
            });
        });
    }
);

module.exports = router;
