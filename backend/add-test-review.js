require('dotenv').config();
const mysql = require('mysql2/promise');

if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD not set. Create a .env file with DB_PASSWORD.');
  process.exit(1);
}

async function addTestReview() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'naturanza_foods'
    });

    console.log('\n📝 Adding Test Review...\n');
    
    // First, get a user and product
    const [users] = await conn.query('SELECT id, name, email FROM users WHERE role = "customer" LIMIT 1');
    const [products] = await conn.query('SELECT id, name FROM products LIMIT 1');
    
    if (users.length === 0) {
      console.log('❌ No customer user found! Creating a test customer...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Test@123', 12);
      
      const [result] = await conn.query(
        `INSERT INTO users (name, email, password, role, is_active, created_at) 
         VALUES (?, ?, ?, 'customer', true, NOW())`,
        ['Test Customer', 'testcustomer@gmail.com', hashedPassword]
      );
      
      users[0] = {
        id: result.insertId,
        name: 'Test Customer',
        email: 'testcustomer@gmail.com'
      };
      
      console.log('✅ Test customer created!');
    }
    
    if (products.length === 0) {
      console.log('❌ No products found in database!');
      await conn.end();
      return;
    }
    
    const user = users[0];
    const product = products[0];
    
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`Product: ${product.name}`);
    console.log('');
    
    // Insert test review
    const [result] = await conn.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment, is_approved, created_at) 
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [
        user.id,
        product.id,
        5,
        'This is a test review to demonstrate the real-time review moderation system. Great product!'
      ]
    );
    
    console.log('✅ Test review added successfully!\n');
    console.log('Review Details:');
    console.log(`- Review ID: ${result.insertId}`);
    console.log(`- Customer: ${user.name}`);
    console.log(`- Product: ${product.name}`);
    console.log('- Rating: 5/5');
    console.log('- Status: PENDING (waiting for admin approval)');
    console.log('');
    console.log('👉 Now check your admin dashboard at: http://localhost:5173/admin/reviews');
    console.log('   The review should appear within 10 seconds!\n');

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addTestReview();
