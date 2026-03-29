// src/routes/artistRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const artistController = require('../controllers/artistController');

// Create a new artist profile (auth required)
router.post('/apply', authMiddleware, artistController.createArtist);

// Backward-compatible alias for frontend
router.post('/become', authMiddleware, artistController.createArtist);

// Current artist profile for logged-in artist/admin
router.get('/me', authMiddleware, requireRole('artist', 'admin'), async (req, res) => {
    try {
        const [rows] = await artistController.getArtistIdByUser(req.user.user_id);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: 'Artist profile not found' });
        }
        return res.json({ artist_id: rows[0].artist_id });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching artist profile', error: err.message });
    }
});

// Catalog by artist (public)
router.get('/:id/catalog', artistController.getArtistCatalog);

// Get artist by ID (public)
router.get('/:id', artistController.getArtist);

// Get all artists (public)
router.get('/', artistController.getAllArtists);

// Admin: verify artist
router.post('/:id/verify', authMiddleware, requireRole('admin'), artistController.verifyArtist);

module.exports = router;
