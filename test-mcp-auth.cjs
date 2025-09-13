const crypto = require('crypto');

// 환경 변수 직접 설정
const API_URL = 'http://localhost:3000/api/v1';
const API_KEY_ID = 'akid_47f82a21352ec75f391a41100e5f490d';
const API_KEY_SECRET = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

async function testAuth() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/api/v1/mcp/posts';
  const body = JSON.stringify({
    title: 'Test Post',
    content_markdown: '# Test Content',
    tags: ['test']
  });

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
    signature,
    secretPrefix: API_KEY_SECRET.substring(0, 15) + '...'
  });

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key-id': API_KEY_ID,  // 소문자로 변경
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
        'x-mcp-client': 'test-client'
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