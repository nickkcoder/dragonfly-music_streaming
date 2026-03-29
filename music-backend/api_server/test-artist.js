require('dotenv').config();
const axios = require('axios');

// -------------------------------
// CONFIG
// -------------------------------
const BASE_URL = "http://localhost:4002"; // your test server port for artist routes
const TEST_USER_EMAIL = "test@example.com"; // existing user
const TEST_USER_PASSWORD = "Test1234!";     // password for test user

async function testArtist() {
    try {
        console.log("1️⃣ Logging in as test user...");

        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD
        });

        const token = loginRes.data.token;
        console.log("✅ Login successful. Token:\n", token);

        console.log("\n2️⃣ Applying as an artist...");

        const applyRes = await axios.post(
            `${BASE_URL}/artist/apply`,
            {
                artist_name: "Test Artist",
                bio: "This is a test artist profile",
                img_url: "uploads/test-artist.jpg"
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        console.log("✅ Artist profile created successfully:");
        console.log(applyRes.data);

        console.log("\n3️⃣ Fetching artist by ID...");

        const artist_id = applyRes.data.artist_id;
        const getRes = await axios.get(`${BASE_URL}/artist/${artist_id}`);
        console.log(getRes.data);

    } catch (err) {
        console.log("❌ ERROR:");
        if (err.response) {
            console.log(err.response.data);
        } else {
            console.log(err.message);
        }
    }
}

testArtist();
