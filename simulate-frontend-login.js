const axios = require('axios');

console.log('🔍 Simulating Frontend Login Flow...\n');

const API_BASE_URL = 'http://localhost:3012/api';

// Simulate the exact frontend login process
async function simulateFrontendLogin() {
  try {
    console.log('1. 📱 Sending login request...');
    
    // This is exactly what the frontend sends
    const loginPayload = {
      phone: '9512087058',  // Frontend sends phone
      password: '12345678'
    };
    
    console.log('Request payload:', JSON.stringify(loginPayload, null, 2));
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, loginPayload);
    
    console.log('2. ✅ Login response received');
    console.log('Status:', response.status);
    console.log('Has access_token:', !!response.data.access_token);
    
    if (response.data.access_token) {
      const token = response.data.access_token;
      
      console.log('3. 🔍 Decoding JWT token...');
      
      // Simulate frontend token decoding
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        console.log('Token payload:');
        console.log('  - Role:', payload.role);
        console.log('  - Username:', payload.username);
        console.log('  - Sub (ID):', payload.sub);
        console.log('  - Validity:', payload.validity_end);
        
        console.log('4. 💾 Simulating localStorage storage...');
        const localStorage = {
          token: token,
          username: '9512087058',
          role: payload.role,
          userId: payload.sub,
          validity_end: payload.validity_end,
          permissions: JSON.stringify(payload.permissions || [])
        };
        
        console.log('LocalStorage would contain:');
        Object.keys(localStorage).forEach(key => {
          console.log(`  - ${key}:`, localStorage[key]);
        });
        
        console.log('5. 🚀 Determining redirect...');
        if (payload.role === 'Admin' || payload.role === 'SuperAdmin' || payload.role === 'Sub-Admin') {
          console.log('   → Should redirect to: /admin');
        } else {
          console.log('   → Should redirect to: /dashboard');
        }
        
        console.log('6. 🔒 Testing protected route access...');
        
        // Test if token works for protected endpoints
        try {
          const profileResponse = await axios.get(`${API_BASE_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('   ✅ Protected route accessible');
          console.log('   User profile:', profileResponse.data.name);
        } catch (error) {
          console.log('   ❌ Protected route failed:', error.response?.data?.message || error.message);
        }
        
      } catch (decodeError) {
        console.log('❌ Token decode failed:', decodeError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Login failed:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
  }
}

simulateFrontendLogin();