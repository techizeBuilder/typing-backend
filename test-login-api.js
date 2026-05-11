const axios = require('axios');

console.log('🔐 Testing Login API...\n');

const API_BASE_URL = 'http://localhost:3012/api';

async function testLoginAPI() {
  try {
    console.log('📡 Testing login API endpoint...');
    console.log(`URL: ${API_BASE_URL}/auth/login`);
    console.log('Credentials: 9512087058 / 12345678\n');

    const loginData = {
      phone: '9512087058',
      password: '12345678'
    };

    console.log('Sending request...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Login API Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.access_token) {
      console.log('\n🎉 Login successful! Token received.');
      
      // Test a protected endpoint with the token
      console.log('\n📋 Testing protected endpoint...');
      const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${response.data.access_token}`
        }
      });
      
      console.log('Profile data:', JSON.stringify(profileResponse.data, null, 2));
    }

  } catch (error) {
    console.log('❌ Login API Error:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🚫 Server is not running!');
      console.log('Please start the server with: npm run start:dev');
    } else if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Also test with different login methods
async function testMultipleLogins() {
  const testCases = [
    { identifier: '9512087058', password: '12345678', description: 'Phone login' },
    { identifier: 'admin', password: 'admin123', description: 'Admin login' },
    { identifier: 'jeetu.mj1234@gmail.com', password: '12345678', description: 'Email login' }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing ${testCase.description}:`);
    console.log(`   ${testCase.identifier} / ${testCase.password}`);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        phone: testCase.identifier,
        password: testCase.password
      });
      
      console.log(`   ✅ Success: ${response.data.user?.name || 'User logged in'}`);
    } catch (error) {
      if (error.response) {
        console.log(`   ❌ Failed: ${error.response.data.message || 'Login failed'}`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }
}

testLoginAPI().then(() => {
  return testMultipleLogins();
}).catch(console.error);