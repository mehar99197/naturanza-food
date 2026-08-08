// Utility script to generate password hash for users
// Usage: 
//   node utils/generateHash.js <password> <user_type>
//   node utils/generateHash.js admin123 admin    (uses 10 salt rounds)
//   node utils/generateHash.js user123 user      (uses 4 salt rounds)

const bcrypt = require('bcryptjs');

async function generateHash(password, userType = 'user') {
    try {
        const saltRounds = 12;
        
        const hash = await bcrypt.hash(password, saltRounds);
        
       
    } catch (error) {
    }
}

const password = process.argv[2] || 'admin123';
const userType = process.argv[3] || 'admin';
generateHash(password, userType);
