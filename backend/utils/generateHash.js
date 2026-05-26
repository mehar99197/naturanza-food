// Utility script to generate password hash for users
// Usage: 
//   node utils/generateHash.js <password> <user_type>
//   node utils/generateHash.js admin123 admin    (uses 10 salt rounds)
//   node utils/generateHash.js user123 user      (uses 4 salt rounds)

const bcrypt = require('bcryptjs');

async function generateHash(password, userType = 'user') {
    try {
        // Determine salt rounds based on user type
        // Admin: 10 rounds (higher security for privileged accounts)
        // Normal users: 4 rounds (faster, sufficient for regular users)
        const saltRounds = userType.toLowerCase() === 'admin' ? 10 : 4;
        
        const hash = await bcrypt.hash(password, saltRounds);
        
       
    } catch (error) {
    }
}

const password = process.argv[2] || 'admin123';
const userType = process.argv[3] || 'admin';
generateHash(password, userType);
