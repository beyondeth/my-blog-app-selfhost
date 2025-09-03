#!/usr/bin/env node
const crypto = require('crypto');

// Configuration
const API_KEY_ID = 'akid_9920609538de2d66c62765b112f9c740';
const API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const API_URL = 'http://localhost:3000/api/v1';

async function testLegacyAuth() {
  console.log('🔐 Testing Legacy Authentication (WITH Secret in Body)');
  console.log('=====================================================');
  
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Legacy way - Secret IN body (still works for backward compatibility)
  const body = JSON.stringify({
    keyId: API_KEY_ID,
    keySecret: API_KEY_SECRET,  // Secret included for legacy support
    timestamp,
    nonce,
  });
  
  // Even legacy method needs a signature (using simple HMAC)
  const message = `${timestamp}:${nonce}:${API_KEY_ID}`;
  const signature = crypto
    .createHmac('sha256', API_KEY_SECRET)
    .update(message)
    .digest('hex');
  
  console.log('\n📝 Request Details:');
  console.log('  - Key ID:', API_KEY_ID);
  console.log('  - Timestamp:', timestamp);
  console.log('  - Nonce:', nonce.substring(0, 8) + '...');
  console.log('  - Body contains keySecret?:', body.includes('keySecret') ? '⚠️ YES (Legacy)' : '✅ NO');
  
  try {
    const response = await fetch(`${API_URL}/auth/verify-api-key-id-secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': API_KEY_ID,
        'X-API-Signature': signature,
        'X-API-Timestamp': timestamp,
        'X-API-Nonce': nonce,
      },
      body
    });
    
    const data = await response.json();
    
    if (response.ok && data.valid) {
      console.log('\n✅ Legacy Authentication Successful!');
      console.log('  - User ID:', data.userId);
      console.log('  - Blog ID:', data.blogId);
      console.log('  - Blog Name:', data.blog?.name);
      console.log('  - Message:', data.message);
      console.log('\n⚠️ WARNING: This method includes Secret in the request body!');
      console.log('🔄 Please migrate to the secure method (without Secret transmission)');
    } else {
      console.error('\n❌ Authentication Failed:', data.message);
      console.error('Response:', data);
    }
  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);
  }
}

testLegacyAuth().catch(console.error);