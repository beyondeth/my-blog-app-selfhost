#!/usr/bin/env node
const crypto = require('crypto');

// Test directly what we're comparing
const API_KEY_ID = 'akid_9920609538de2d66c62765b112f9c740';
const API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';

// Fixed values for consistency
const timestamp = Date.now().toString();
const nonce = 'testnonce' + Math.random();
const method = 'POST';
const uri = '/auth/verify-api-key-id-secret';

// Client creates body without keySecret
const clientBody = JSON.stringify({
  keyId: API_KEY_ID,
  timestamp,
  nonce,
});

console.log('Client Body:', clientBody);

// Client calculates signature
const bodyHash = crypto.createHash("sha256").update(clientBody).digest("hex");
const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(':');
const signature = crypto.createHmac("sha256", API_KEY_SECRET).update(message).digest("hex");

console.log('\nClient Calculation:');
console.log('- Body Hash:', bodyHash);
console.log('- Message:', message);
console.log('- Signature:', signature);

// Server should use the SAME body (normalized without keySecret)
// This is what the server SHOULD calculate
const serverBody = JSON.stringify({
  keyId: API_KEY_ID,
  timestamp,
  nonce,
});

const serverBodyHash = crypto.createHash("sha256").update(serverBody).digest("hex");
const serverMessage = [method, uri, API_KEY_ID, timestamp, nonce, serverBodyHash].join(':');
const serverSignature = crypto.createHmac("sha256", API_KEY_SECRET).update(serverMessage).digest("hex");

console.log('\nServer Should Calculate:');
console.log('- Body Hash:', serverBodyHash);
console.log('- Message:', serverMessage);
console.log('- Signature:', serverSignature);

console.log('\n✅ Signatures Match?', signature === serverSignature);

// Now test the actual API
const API_URL = 'http://localhost:3000/api/v1';

async function testAPI() {
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
      body: clientBody
    });
    
    const data = await response.json();
    
    if (response.ok && data.valid) {
      console.log('\n✅ API Authentication Successful!');
    } else {
      console.log('\n❌ API Authentication Failed:', data.message);
      console.log('The server is NOT calculating the signature correctly.');
    }
  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);
  }
}

testAPI();