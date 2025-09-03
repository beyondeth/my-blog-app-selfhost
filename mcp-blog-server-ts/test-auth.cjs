#!/usr/bin/env node

// Test authentication with the modified TypeScript code

const crypto = require('crypto');
const https = require('http');

// Configuration from environment
const apiKeyId = 'akid_9920609538de2d66c62765b112f9c740';
const apiKeySecret = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const baseUrl = 'http://localhost:3000';
const apiUrl = `${baseUrl}/api/v1`;

// Create AWS-style signature
function createAwsStyleSignature(method, uri, timestamp, nonce, body = '') {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
  const signature = crypto
    .createHmac('sha256', apiKeySecret)
    .update(stringToSign)
    .digest('hex');
  return signature;
}

async function testAuthentication() {
  console.log('🔑 Testing TypeScript MCP Authentication...\n');
  
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/auth/verify-api-key-id-secret';
  
  const body = JSON.stringify({
    keyId: apiKeyId,
    keySecret: apiKeySecret,
    timestamp,
    nonce,
  });
  
  const signature = createAwsStyleSignature(method, uri, timestamp, nonce, body);
  
  console.log('Request Details:');
  console.log('- Endpoint:', `${apiUrl}${uri}`);
  console.log('- Timestamp:', timestamp);
  console.log('- Nonce:', nonce);
  console.log('- Signature:', signature);
  console.log();
  
  try {
    // Make the request using fetch (Node.js 18+)
    const response = await fetch(`${apiUrl}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': apiKeyId,
        'X-API-Signature': signature,
        'X-API-Timestamp': timestamp,
        'X-API-Nonce': nonce,
      },
      body,
    });
    
    const data = await response.json();
    
    if (response.ok && data.valid) {
      console.log('✅ Authentication successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Authentication failed');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Run the test
testAuthentication();