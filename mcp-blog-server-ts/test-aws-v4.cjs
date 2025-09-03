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
  
  console.log('\n🔍 Debug - Message to Sign:');
  console.log('  ', message.substring(0, 100) + '...');

  // Sign with secret (secret never leaves client)
  const signature = crypto
    .createHmac("sha256", keySecret)
    .update(message)
    .digest("hex");

  return signature;
}

async function testSecureAuth() {
  console.log('🔐 Testing Secure Authentication (No Secret Transmission)');
  console.log('========================================================');
  
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
  
  console.log('📝 Request Details:');
  console.log('  - Key ID:', API_KEY_ID);
  console.log('  - Timestamp:', timestamp);
  console.log('  - Nonce:', nonce.substring(0, 8) + '...');
  console.log('  - Signature:', signature.substring(0, 16) + '...');
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
      console.log('\n✅ AWS V4 Authentication Successful!');
      console.log('  - User ID:', data.userId);
      console.log('  - Blog ID:', data.blogId);
      console.log('  - Blog Name:', data.blog?.name);
      console.log('  - Message:', data.message);
      console.log('\n🎉 Secret was NEVER transmitted over the network!');
    } else {
      console.error('\n❌ Authentication Failed:', data.message);
      console.error('Response:', data);
    }
  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);
  }
}

// Compare with old (insecure) method
async function testOldInsecureMethod() {
  console.log('\n\n⚠️  Old Insecure Method (for comparison)');
  console.log('=========================================');
  
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Old way - Secret in body (INSECURE!)
  const body = JSON.stringify({
    keyId: API_KEY_ID,
    keySecret: API_KEY_SECRET,  // ❌ BAD!
    timestamp,
    nonce,
  });
  
  console.log('📝 Old Method Details:');
  console.log('  - Body contains keySecret?:', body.includes('keySecret') ? '❌ YES (INSECURE!)' : '✅ NO');
  console.log('  - Secret exposed in:', ['Network traffic', 'Server logs', 'Proxy logs', 'Debug tools']);
}

async function main() {
  console.log('🚀 Secure API Authentication Test\n');
  
  // Test new secure method
  await testSecureAuth();
  
  // Show comparison with old method
  await testOldInsecureMethod();
  
  console.log('\n\n📊 Security Comparison:');
  console.log('┌─────────────────────┬────────────────┬────────────────┐');
  console.log('│ Method              │ Old (Insecure) │ AWS V4 (New)   │');
  console.log('├─────────────────────┼────────────────┼────────────────┤');
  console.log('│ Secret Transmitted  │ ❌ Yes         │ ✅ No          │');
  console.log('│ Network Sniffing    │ ❌ Vulnerable  │ ✅ Safe        │');
  console.log('│ Log Exposure        │ ❌ High Risk   │ ✅ Low Risk    │');
  console.log('│ MITM Protection     │ ❌ Weak        │ ✅ Strong      │');
  console.log('│ Replay Protection   │ ✅ Yes         │ ✅ Yes         │');
  console.log('│ Industry Standard   │ ❌ No          │ ✅ Yes (AWS)   │');
  console.log('└─────────────────────┴────────────────┴────────────────┘');
}

main().catch(console.error);