const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Database Connection...\n');

// Test 1: Direct VPS connection (what should work)
console.log('📡 Test 1: Direct VPS Connection');
const vpsClient = new Client({
  host: '193.203.161.214',
  port: 5432,
  user: 'typing_user',
  password: 'Admin@2001',
  database: 'typing_master',
});

// Test 2: Using environment variables (what your app uses)
console.log('🔧 Test 2: Environment Variables Connection');
console.log('ENV Values:');
console.log(`  DB_HOST: ${process.env.DB_HOST}`);
console.log(`  DB_PORT: ${process.env.DB_PORT}`);
console.log(`  DB_USERNAME: ${process.env.DB_USERNAME}`);
console.log(`  DB_DATABASE: ${process.env.DB_DATABASE}\n`);

const envClient = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function testConnections() {
  // Test VPS connection
  try {
    await vpsClient.connect();
    console.log('✅ VPS Connection: SUCCESS');
    await vpsClient.end();
  } catch (error) {
    console.log('❌ VPS Connection: FAILED');
    console.log('Error:', error.message);
  }

  // Test ENV connection
  try {
    await envClient.connect();
    console.log('✅ ENV Connection: SUCCESS');
    console.log('🎉 Your .env file is working correctly!');
    await envClient.end();
  } catch (error) {
    console.log('❌ ENV Connection: FAILED');
    console.log('Error:', error.message);
    console.log('🔧 This means your .env file has wrong values');
  }
}

testConnections().catch(console.error);