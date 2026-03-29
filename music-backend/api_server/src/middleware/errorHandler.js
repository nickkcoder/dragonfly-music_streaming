const multer = require('multer');
const jwt = require('jsonwebtoken');

function errorHandler(err, req, res, next) {
    console.error('🔥 ERROR:', err);

    // Default values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // 🔐 JWT errors
    if (err instanceof jwt.JsonWebTokenError) {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err instanceof jwt.TokenExpiredError) {
        statusCode = 401;
        message = 'Token expired';
    }

    // 📦 Multer file upload errors
    if (err instanceof multer.MulterError) {
        statusCode = 400;
        message = err.message;
    }

    // 🗄️ MySQL errors (optional pattern match)
    if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 400;
        message = 'Duplicate entry';
    }

    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        statusCode = 400;
        message = 'Invalid foreign key reference';
    }

    // 🛑 Custom thrown errors
    if (err.message === 'Artist not linked to user') {
        statusCode = 403;
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = errorHandler;
