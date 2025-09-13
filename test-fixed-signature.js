const crypto = require('crypto');

// Configuration
const API_URL = 'http://localhost:3000/api/v1';
const API_KEY_ID = 'akid_47f82a21352ec75f391a41100e5f490d';
const API_KEY_SECRET = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

async function testAuth() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/api/v1/mcp/posts'; // Full URI path that backend will receive
  const body = JSON.stringify({
    title: 'Test Post from Fixed Script',
    content_markdown: '# Test Content\n\nThis is a test.',
    tags: ['test', 'oracle']
  });

  // Generate HMAC signature
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(':');
  const signature = crypto.createHmac('sha256', API_KEY_SECRET).update(message).digest('hex');

  console.log('Request details:');
  console.log('- Method:', method);
  console.log('- URI for signature:', uri);
  console.log('- Key ID:', API_KEY_ID);
  console.log('- Timestamp:', timestamp);
  console.log('- Nonce:', nonce);
  console.log('- Body hash:', bodyHash);
  console.log('- Signature:', signature);
  console.log('- Actual URL:', `${API_URL}/mcp/posts`);

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key-id': API_KEY_ID,
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
        'x-mcp-client': 'test-fixed'
      },
      body
    });

    const result = await response.text();
    console.log('\nResponse status:', response.status);
    console.log('Response:', result);

    if (response.ok) {
      console.log('\n✅ SUCCESS! Authentication and post creation worked!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuth();