// 평문 API key 방식 테스트

const API_KEY_SECRET = 'aks_4d92b1f71350c93011d9c1dca714d9e171df6333fa8160b65d65791b175aa544';
const API_URL = 'http://localhost:3000/api/v1';

async function testPlainApiKey() {
  const body = JSON.stringify({
    title: '오라클 주가 36% 급등: 트럼프와 손잡고 AI 인프라 혁명 시작',
    content_markdown: '# 테스트 포스트\n\n오라클과 트럼프의 프로젝트 스타게이트...',
    tags: ['오라클', 'AI', 'test', 'ai:claude']
  });

  console.log('Using plain API key as Bearer token...');
  console.log('API Key:', API_KEY_SECRET.substring(0, 20) + '...');

  try {
    const response = await fetch(`${API_URL}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY_SECRET}`, // 평문 API key를 Bearer로
      },
      body
    });

    const responseText = await response.text();
    console.log('\nResponse Status:', response.status);
    console.log('Response:', responseText);

    if (response.ok) {
      console.log('✅ Success! Post created with plain API key');
    } else {
      console.log('❌ Failed:', responseText);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testPlainApiKey();