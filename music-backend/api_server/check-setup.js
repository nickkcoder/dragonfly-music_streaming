const pool = require('./src/config/db');

async function checkSetup() {
    try {
        console.log("Checking DB connection...");
        const conn = await pool.getConnection();
        console.log("✅ DB Connected!");
        conn.release();

        console.log("Checking for admin_user...");
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', ['admin_user']);
        if (rows.length > 0) {
            console.log("✅ admin_user exists.");
        } else {
            console.log("❌ admin_user does NOT exist.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Setup check failed:", err.message);
        process.exit(1);
    }
}

checkSetup();
