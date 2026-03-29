const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

async function hashNewPassword() {
    const password = 'Test1234!'; // new password
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log(hash);
}
hashNewPassword();
