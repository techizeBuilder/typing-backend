const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log('🔐 Testing Login Credentials...\n');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function testLogin(identifier, password) {
  try {
    await client.connect();
    
    console.log(`Testing login: ${identifier} / ${password}`);
    
    // Try to find user by phone or user_id
    const query = `
      SELECT user_id, name, phone, password_hash, role, status 
      FROM users 
      WHERE phone = $1 OR user_id = $1
    `;
    
    const result = await client.query(query, [identifier]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return false;
    }
    
    const user = result.rows[0];
    console.log(`✅ User found: ${user.name} (${user.user_id})`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Status: ${user.status}`);
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (isPasswordValid) {
      console.log('✅ Password is correct!');
      return true;
    } else {
      console.log('❌ Password is incorrect');
      
      // Let's try to figure out what the password might be
      console.log('\n🔍 Trying common passwords...');
      const commonPasswords = [
        '12345678', '123456', 'password', 'admin123', 
        '9512087058', 'jeet', 'jeetu', '1234', '0000'
      ];
      
      for (const testPass of commonPasswords) {
        const match = await bcrypt.compare(testPass, user.password_hash);
        if (match) {
          console.log(`✅ FOUND IT! Password is: "${testPass}"`);
          return true;
        }
      }
      console.log('❌ Could not find the correct password');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Test the login from your screenshot
testLogin('9512087058', '12345678');