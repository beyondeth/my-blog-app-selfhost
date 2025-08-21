/**
 * 간단한 동시성 테스트
 */
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function testSimpleConcurrent() {
  console.log('🧪 간단한 동시성 테스트 시작...\n');
  
  // 1. 로그인
  let authCookie = '';
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'loadtest@example.com',
      password: 'Test123!@#'
    });
    
    if (loginRes.headers['set-cookie']) {
      authCookie = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      console.log('✅ 로그인 성공');
    }
  } catch (error) {
    console.log('계정 생성 중...');
    await axios.post(`${API_URL}/auth/register`, {
      email: 'loadtest@example.com',
      password: 'Test123!@#',
      username: 'loadtester'
    });
    
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'loadtest@example.com',
      password: 'Test123!@#'
    });
    authCookie = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    console.log('✅ 계정 생성 및 로그인 성공');
  }
  
  // 2. 테스트 포스트 생성
  const postRes = await axios.post(`${API_URL}/posts`, {
    title: `Test Post ${Date.now()}`,
    content: 'Test content'
  }, {
    headers: { 'Cookie': authCookie }
  });
  
  const postId = postRes.data.id;
  console.log(`✅ 테스트 포스트 생성: ${postId}\n`);
  
  // 3. 30개의 동시 좋아요 요청
  console.log('🚀 30개의 동시 좋아요 요청 시작...');
  
  const promises = [];
  for (let i = 0; i < 30; i++) {
    promises.push(
      axios.post(`${API_URL}/posts/${postId}/like`, {}, {
        headers: { 'Cookie': authCookie },
        timeout: 10000 // 10초 타임아웃
      }).then(() => ({ success: true }))
        .catch(err => ({ 
          success: false, 
          error: err.response?.status || err.message 
        }))
    );
  }
  
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 성공: ${successful}`);
  console.log(`❌ 실패: ${failed}`);
  
  if (failed > 0) {
    console.log('\n실패 상세:');
    results.filter(r => !r.success).forEach((r, i) => {
      console.log(`  - 에러: ${r.error}`);
    });
  }
  
  // 4. 최종 상태 확인
  console.log('\n📊 최종 포스트 상태 확인...');
  const finalPost = await axios.get(`${API_URL}/posts/${postId}`, {
    headers: { 'Cookie': authCookie }
  });
  
  console.log(`  좋아요 수: ${finalPost.data.likeCount}`);
  console.log(`  사용자가 좋아요 눌렀는지: ${finalPost.data.isLiked}`);
}

testSimpleConcurrent().catch(console.error);