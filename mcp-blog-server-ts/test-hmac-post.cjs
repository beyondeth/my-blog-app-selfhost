const crypto = require('crypto');

// 환경 변수 설정
const API_KEY_ID = 'akid_9920609538de2d66c62765b112f9c740';
const API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const API_URL = 'http://localhost:3000/api/v1';

async function testHmacPost() {
  // Generate security parameters
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const method = 'POST';
  const uri = '/mcp/posts';
  
  // Prepare request body
  const body = JSON.stringify({
    title: '오라클 주가 36% 급등: 트럼프와 손잡고 AI 인프라 혁명 시작',
    content_markdown: '# 테스트 포스트\n\n오라클과 트럼프의 프로젝트 스타게이트...',
    tags: ['오라클', 'AI', 'test', 'ai:claude']
  });

  // Generate HMAC signature
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [method, uri, timestamp, nonce, bodyHash].join(':');
  const signature = crypto.createHmac('sha256', API_KEY_SECRET).update(message).digest('hex');

  console.log('Request Details:');
  console.log('- API Key ID:', API_KEY_ID);
  console.log('- Timestamp:', timestamp);
  console.log('- Nonce:', nonce);
  console.log('- Signature:', signature);
  console.log('- Body Hash:', bodyHash);

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': API_KEY_ID,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature,
      },
      body
    });

    const responseText = await response.text();
    console.log('\nResponse Status:', response.status);
    console.log('Response:', responseText);

    if (response.ok) {
      console.log('✅ Success! Post created with HMAC authentication');
    } else {
      console.log('❌ Failed:', responseText);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testHmacPost();