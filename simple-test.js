const crypto = require('crypto');

// Simple GET test
async function testGet() {
  const API_URL = 'http://localhost:3000/api/v1';
  const API_KEY_ID = 'akid_47f82a21352ec75f391a41100e5f490d';
  const API_KEY_SECRET = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'GET';
  const uri = '/api/v1/mcp/posts';
  const body = '';  // Empty for GET

  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(':');
  const signature = crypto.createHmac('sha256', API_KEY_SECRET).update(message).digest('hex');

  console.log('Testing GET /mcp/posts...');

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'GET',
      headers: {
        'x-api-key-id': API_KEY_ID,
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
        'x-mcp-client': 'test-get'
      }
    });

    const result = await response.text();
    console.log('Response:', response.status, result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGet();