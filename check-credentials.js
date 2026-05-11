const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log('🔍 Checking Database Credentials...\n');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function checkCredentials() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check all users in database
    const usersResult = await client.query('SELECT user_id, name, phone, role, status, password_hash FROM users ORDER BY user_id');
    
    console.log('👥 Users in database:');
    console.log('='.repeat(80));
    
    if (usersResult.rows.length === 0) {
      console.log('❌ NO USERS FOUND! Database is empty.');
      return;
    }

    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.user_id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Password Hash: ${user.password_hash.substring(0, 20)}...`);
      console.log('');
    });

    // Test the admin login specifically
    console.log('🔐 Testing Admin Login:');
    console.log('='.repeat(50));
    
    const adminUser = usersResult.rows.find(u => u.user_id === 'admin');
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log(`Admin found: ${adminUser.name}`);
    console.log(`Stored hash: ${adminUser.password_hash}`);
    
    // Test password comparison
    const testPasswords = ['admin123', 'admin', '123456', 'password'];
    
    for (const testPass of testPasswords) {
      const isMatch = await bcrypt.compare(testPass, adminUser.password_hash);
      console.log(`Password "${testPass}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

    // Test the phone number login too
    console.log('\n📱 Testing Phone Number Login:');
    console.log('='.repeat(50));
    
    const phoneUser = usersResult.rows.find(u => u.phone === '9512087058');
    if (phoneUser) {
      console.log(`Phone user found: ${phoneUser.name} (${phoneUser.user_id})`);
      for (const testPass of ['12345678', '123456', 'password', 'admin123']) {
        const isMatch = await bcrypt.compare(testPass, phoneUser.password_hash);
        console.log(`Password "${testPass}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      }
    } else {
      console.log('❌ No user found with phone 9512087058');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCredentials();