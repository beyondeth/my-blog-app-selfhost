const crypto = require('crypto');

const API_URL = process.env.BLOG_API_URL || 'http://localhost:3000/api/v1';
const API_KEY_ID = process.env.BLOG_API_KEY_ID;
const API_KEY_SECRET = process.env.BLOG_API_KEY_SECRET;

console.log('Testing with:', {
  API_URL,
  API_KEY_ID: API_KEY_ID,
  API_KEY_SECRET: API_KEY_SECRET ? '***' + API_KEY_SECRET.slice(-4) : 'NOT SET'
});

async function testAuth() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/api/v1/mcp/auth';
  const body = JSON.stringify({ action: 'authenticate' });

  // Generate HMAC signature (complex method)
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(':');
  const signature = crypto.createHmac('sha256', API_KEY_SECRET).update(message).digest('hex');

  console.log('Signature components:', {
    method,
    uri,
    keyId: API_KEY_ID,
    timestamp,
    nonce,
    bodyHash,
    message,
    signature
  });

  try {
    const response = await fetch(`${API_URL}/mcp/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY_ID,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
      },
      body
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuth();