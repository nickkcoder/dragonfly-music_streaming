// test-admin-server.js
require('dotenv').config(); // load .env
const express = require('express');
const app = express();
const port = 4001; // test server port

app.use(express.json());

// Import routes
const authRoutes = require('./src/routes/authRoutes');       // adjust path if needed
const adminRoutes = require('./src/routes/adminRoutes'); // adjust path if needed

// Use routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// Root route for quick check
app.get('/', (req, res) => {
    res.send('Test Admin Server is running');
});

// Start server
app.listen(port, () => {
    console.log(`Test Admin Server running at http://localhost:${port}`);
});
