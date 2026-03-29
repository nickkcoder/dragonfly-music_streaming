require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const path = require('path');
const cors = require('cors');

// Enable JSON body parsing
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
  credentials: true
}));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Upload routes
const uploadRoutes = require('./src/routes/uploadRoutes');
app.use('/upload', uploadRoutes);

// Test route
app.get('/', (req, res) => res.send('Media Server Running!'));

app.listen(port, () => console.log(`Media server listening at http://localhost:${port}`));
