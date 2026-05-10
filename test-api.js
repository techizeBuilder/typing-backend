const https = require('https');
const http = require('http');

const API_BASE = 'https://typing.techizebuilder.com/api';

// Test endpoints
const endpoints = [
  '/',
  '/users',
  '/exams', 
  '/chapters',
  '/results',
  '/result-patterns',
  '/messages',
  '/flash-banners'
];

console.log('🔍 Testing API endpoints...\n');

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = API_BASE + endpoint;
    console.log(`Testing: ${url}`);
    
    const request = https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`✅ ${endpoint} - Status: ${response.statusCode}`);
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(json).substring(0, 100)}...`);
          } catch (e) {
            console.log(`   Response: ${data.substring(0, 100)}...`);
          }
        }
        console.log('');
        resolve();
      });
    });
    
    request.on('error', (error) => {
      console.log(`❌ ${endpoint} - Error: ${error.message}\n`);
      resolve();
    });
    
    request.setTimeout(5000, () => {
      console.log(`⏰ ${endpoint} - Timeout\n`);
      request.destroy();
      resolve();
    });
  });
}

async function runTests() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  console.log('🏁 API testing completed!');
}

runTests();