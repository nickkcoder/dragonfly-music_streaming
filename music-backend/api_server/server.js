require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 4000;
const cors = require('cors');

// Middleware
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const artistRoutes = require('./src/routes/artistRoutes');
const songRoutes = require('./src/routes/songRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// Register routes (ONLY ONCE)
app.use('/api/auth', authRoutes);
app.use('/api/artist', artistRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
    res.send('Music API Server is running');
});

// Import error handler
const errorHandler = require('./src/middleware/errorHandler');

// 👇 MUST be after routes
app.use(errorHandler);

// Start server LAST
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

