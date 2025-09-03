#!/usr/bin/env node
const crypto = require('crypto');

// Configuration
const API_KEY_ID = 'akid_9920609538de2d66c62765b112f9c740';
const API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const API_URL = 'http://localhost:3000/api/v1';

function createSecureSignature(method, uri, timestamp, nonce, keyId, keySecret, body = "") {
  // Create message to sign (includes all critical request elements)
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const message = [
    method,
    uri,
    keyId,
    timestamp,
    nonce,
    bodyHash
  ].join(':');
  
  console.log('\n🔍 Client Side Debug:');
  console.log('  - Method:', method);
  console.log('  - URI:', uri);
  console.log('  - KeyId:', keyId);
  console.log('  - Timestamp:', timestamp);
  console.log('  - Nonce:', nonce);
  console.log('  - Body:', body.substring(0, 100) + '...');
  console.log('  - Body Hash:', bodyHash.substring(0, 32) + '...');
  console.log('  - Message to Sign:', message.substring(0, 100) + '...');

  // Sign with secret (secret never leaves client)
  const signature = crypto
    .createHmac("sha256", keySecret)
    .update(message)
    .digest("hex");
    
  console.log('  - Signature:', signature.substring(0, 32) + '...');

  return signature;
}

async function testSecureAuthDebug() {
  console.log('🔐 Testing Secure Authentication with Debug Info');
  console.log('================================================');
  
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Body WITHOUT keySecret!
  const body = JSON.stringify({
    keyId: API_KEY_ID,
    timestamp,
    nonce,
    // NO keySecret here - only used for signing
  });
  
  const signature = createSecureSignature(
    'POST',
    '/auth/verify-api-key-id-secret',
    timestamp,
    nonce,
    API_KEY_ID,
    API_KEY_SECRET,
    body
  );
  
  console.log('\n📝 Request Summary:');
  console.log('  - Body contains keySecret?:', body.includes('keySecret') ? '❌ YES (BAD!)' : '✅ NO (GOOD!)');
  
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
      console.log('\n✅ Secure Authentication Successful!');
      console.log('  - User ID:', data.userId);
      console.log('  - Blog ID:', data.blogId);
      console.log('  - Blog Name:', data.blog?.name);
      console.log('  - Message:', data.message);
      console.log('\n🎉 Secret was NEVER transmitted over the network!');
    } else {
      console.error('\n❌ Authentication Failed:', data.message);
      console.error('Response:', data);
      
      // Debug info
      console.log('\n🔧 Debug Info for Server-Side Comparison:');
      console.log('  - Expected the server to generate the same signature using:');
      console.log('    - Method: POST');
      console.log('    - URI: /auth/verify-api-key-id-secret');
      console.log('    - KeyId:', API_KEY_ID);
      console.log('    - Timestamp:', timestamp);
      console.log('    - Nonce:', nonce);
      console.log('    - Body:', body.substring(0, 100));
      console.log('    - KeySecret: (stored in database, not transmitted)');
    }
  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);
  }
}

testSecureAuthDebug().catch(console.error);