require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:4002';

async function testDeleteSong() {
    try {
        console.log('1️⃣ Logging in...');

        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'testuser', // artist user
            password: 'Test1234!'
        });

        const token = loginRes.data.token;

        console.log('2️⃣ Deleting song...');

        const res = await axios.delete(
            `${BASE_URL}/songs/2`, // replace with real song_id
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        console.log('✅ SUCCESS:', res.data);

    } catch (err) {
        console.log('❌ ERROR:');
        if (err.response) console.log(err.response.data);
        else console.log(err.message);
    }
}

testDeleteSong();
