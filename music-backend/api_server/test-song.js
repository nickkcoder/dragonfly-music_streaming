// test-song.js
require('dotenv').config();
const axios = require('axios');

const BASE_URL = "http://localhost:4002";

async function testSongUpload() {
    try {
        console.log("1️⃣ Logging in as artist/admin...");

        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: "admin_user",
            password: "Admin123!!"
        });

        const token = loginRes.data.token;
        console.log("✅ Login successful.");

        console.log("\n2️⃣ Creating a test song...");

        const songRes = await axios.post(
            `${BASE_URL}/songs`,
            {
                artist_id: 1,
                title: "Controller Test Song",
                file_url: "uploads/test-file.mp3",
                duration_seconds: 180
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        console.log("✅ Song created:");
        console.log(songRes.data);

    } catch (err) {
        console.log("❌ ERROR:");
        if (err.response) console.log(err.response.data);
        else console.log(err.message);
    }
}

testSongUpload();
