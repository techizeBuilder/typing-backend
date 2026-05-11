const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log('🔧 Resetting Password...\n');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function resetPassword(phone, newPassword) {
  try {
    await client.connect();
    
    console.log(`Resetting password for phone: ${phone}`);
    console.log(`New password: ${newPassword}`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`Hashed password: ${hashedPassword}`);
    
    // Update the user's password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1 
      WHERE phone = $2
      RETURNING user_id, name, phone
    `;
    
    const result = await client.query(updateQuery, [hashedPassword, phone]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return false;
    }
    
    const user = result.rows[0];
    console.log(`✅ Password updated for: ${user.name} (${user.user_id})`);
    
    // Test the new password
    console.log('\n🔍 Testing new password...');
    const testQuery = `SELECT password_hash FROM users WHERE phone = $1`;
    const testResult = await client.query(testQuery, [phone]);
    
    const isValid = await bcrypt.compare(newPassword, testResult.rows[0].password_hash);
    console.log(`Password test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Reset password for the user trying to login
resetPassword('9512087058', '12345678');