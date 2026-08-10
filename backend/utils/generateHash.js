const bcrypt = require('bcryptjs');

async function generateHash(password) {
    try {
        const hash = await bcrypt.hash(password, 12);
        console.log(`Hash: ${hash}`);
        console.log(`Length: ${hash.length} characters`);
        console.log(`Salt rounds: 12`);
    } catch (error) {
        console.error('Error generating hash:', error.message);
    }
}

if (require.main === module) {
    const password = process.argv[2];
    if (!password) {
        console.error("Password argument is required");
        process.exit(1);
    }
    generateHash(password);
}
