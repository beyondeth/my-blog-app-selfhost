#!/usr/bin/env node

// Test script to compare HMAC signature generation between Python and TypeScript

const crypto = require('crypto');

// Test values
const apiKeySecret = 'aks_test_secret_key_123456789';
const method = 'POST';
const uri = '/mcp/auth/verify';
const timestamp = '1735708800000'; // Fixed timestamp for testing
const nonce = 'test-nonce-123';
const body = JSON.stringify({
  apiKeyId: 'akid_test_id',
  timestamp: timestamp,
  nonce: nonce
});

console.log('=== HMAC Signature Test ===\n');

console.log('Input Values:');
console.log('- Method:', method);
console.log('- URI:', uri);
console.log('- Timestamp:', timestamp);
console.log('- Nonce:', nonce);
console.log('- Body:', body);
console.log('- Secret:', apiKeySecret);
console.log();

// TypeScript/Node.js implementation
function createAwsStyleSignature(method, uri, timestamp, nonce, body = '') {
  // 1. Create Canonical Request
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
  
  console.log('Step 1 - Canonical Request:');
  console.log(canonicalRequest);
  console.log('Body Hash:', bodyHash);
  console.log();
  
  // 2. Create String to Sign
  const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
  
  console.log('Step 2 - String to Sign:');
  console.log(stringToSign);
  console.log('Request Hash:', requestHash);
  console.log();
  
  // 3. Create signature with Secret
  const signature = crypto
    .createHmac('sha256', apiKeySecret)
    .update(stringToSign)
    .digest('hex');
  
  console.log('Step 3 - Final Signature:');
  console.log(signature);
  console.log();
  
  return signature;
}

// Python equivalent (simulated in JS for comparison)
function createPythonStyleSignature(method, uri, timestamp, nonce, body = '') {
  // Python uses the same logic, so should produce same result
  const bodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const requestHash = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
  const signature = crypto
    .createHmac('sha256', apiKeySecret.toString('utf8'))
    .update(stringToSign.toString('utf8'))
    .digest('hex');
  
  return signature;
}

console.log('=== TypeScript Style ===');
const tsSignature = createAwsStyleSignature(method, uri, timestamp, nonce, body);

console.log('=== Python Style (simulated) ===');
const pySignature = createPythonStyleSignature(method, uri, timestamp, nonce, body);
console.log('Signature:', pySignature);
console.log();

console.log('=== Comparison ===');
console.log('TypeScript signature:', tsSignature);
console.log('Python signature:    ', pySignature);
console.log('Signatures match:', tsSignature === pySignature);
console.log();

// Test different endpoint that Python actually uses
console.log('=== Testing Python\'s actual endpoint ===');
const pythonUri = '/auth/verify-api-key-id-secret';
const pythonBody = JSON.stringify({
  keyId: 'akid_test_id',
  keySecret: apiKeySecret,
  timestamp: timestamp,
  nonce: nonce
});

console.log('Python actual URI:', pythonUri);
console.log('Python actual body:', pythonBody);

const pythonActualSignature = createAwsStyleSignature(method, pythonUri, timestamp, nonce, pythonBody);
console.log('Python actual signature:', pythonActualSignature);