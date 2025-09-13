const crypto = require('crypto');

// Direct test with correct signature
async function testDirectPost() {
  const API_URL = 'http://localhost:3000/api/v1';
  const API_KEY_ID = 'akid_47f82a21352ec75f391a41100e5f490d';
  const API_KEY_SECRET = 'aks_81e78dc95cf5ed8433f9cb514e68b35233877c6a18640f33f27e9b0ebd6b0cde';

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/api/v1/mcp/posts';  // FULL PATH for signature

  const body = JSON.stringify({
    title: '오라클 주가 36% 급등: 트럼프의 프로젝트 스타게이트',
    content_markdown: '# 오라클 급등 소식\n\n오라클 주가가 36% 급등했습니다. 트럼프의 프로젝트 스타게이트 발표가 원인입니다.',
    tags: ['oracle', 'ai', 'trump', 'ai:claude']
  });

  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [method, uri, API_KEY_ID, timestamp, nonce, bodyHash].join(':');
  const signature = crypto.createHmac('sha256', API_KEY_SECRET).update(message).digest('hex');

  console.log('🔐 Signature Details:');
  console.log('  URI for signature:', uri);
  console.log('  Timestamp:', timestamp);
  console.log('  Nonce:', nonce);
  console.log('  Signature:', signature);

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key-id': API_KEY_ID,
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
        'x-mcp-client': 'direct-test'
      },
      body
    });

    const result = await response.text();
    console.log('\n📬 Response:', response.status, result);

    if (response.ok) {
      console.log('\n✅ SUCCESS! Post created!');
      const post = JSON.parse(result);
      console.log('Post ID:', post.id);
      console.log('Post Slug:', post.slug);
    } else {
      console.log('\n❌ Failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectPost();