const crypto = require('crypto');

// Same values as in .env
const API_KEY_ID = 'akid_47f82a21352ec75f391a41100e5f490d';
const API_KEY_SECRET = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

// Test data
const method = 'POST';
const uri = '/mcp/posts';
const timestamp = '1736831234567';
const nonce = 'abc123def456';
const body = JSON.stringify({
  title: 'Test Post',
  content_markdown: '# Test Content',
  tags: ['test']
});

// Generate signature exactly as MCP client does
const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(":");
const signature = crypto.createHmac("sha256", API_KEY_SECRET).update(message).digest("hex");

console.log('Client-side signature generation:');
console.log('================================');
console.log('Body:', body);
console.log('Body Hash:', bodyHash);
console.log('Message components:');
console.log('  Method:', method);
console.log('  URI:', uri);
console.log('  Key ID:', API_KEY_ID);
console.log('  Timestamp:', timestamp);
console.log('  Nonce:', nonce);
console.log('Full Message:', message);
console.log('Signature:', signature);
console.log('Secret (first 15 chars):', API_KEY_SECRET.substring(0, 15));

// Now simulate what backend should compute
console.log('\n\nBackend verification (what should match):');
console.log('=========================================');

// Backend extracts headers and body
const headers = {
  'x-api-key-id': API_KEY_ID,
  'x-timestamp': timestamp,
  'x-nonce': nonce,
  'x-signature': signature
};

// Backend would compute the same
const backendBodyHash = crypto.createHash('sha256').update(body).digest('hex');
const backendMessage = [method, uri, API_KEY_ID, timestamp, nonce, backendBodyHash].join(':');
const backendSignature = crypto.createHmac('sha256', API_KEY_SECRET).update(backendMessage).digest('hex');

console.log('Backend body hash:', backendBodyHash);
console.log('Backend message:', backendMessage);
console.log('Backend signature:', backendSignature);
console.log('Signatures match:', signature === backendSignature);