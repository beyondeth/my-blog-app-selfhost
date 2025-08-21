/**
 * 동시성 부하 테스트 스크립트
 * 
 * 사용법:
 * node test-concurrent-load.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const NUM_CONCURRENT_REQUESTS = 50; // 동시 요청 수
const TEST_DURATION_MS = 10000; // 테스트 지속 시간 (10초)

// 테스트용 계정 정보
const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'Test123!@#',
  username: 'loadtester'
};

// 통계
let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  errors: {},
  responseTimes: []
};

// 쿠키 저장용
let authCookie = '';

// 로그인
async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    }, {
      validateStatus: () => true
    });

    if (response.status === 201 || response.status === 200) {
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        authCookie = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ 로그인 성공');
        return true;
      }
    } else if (response.status === 401) {
      // 계정이 없으면 생성
      return await createAccount();
    }
  } catch (error) {
    console.error('❌ 로그인 실패:', error.message);
  }
  return false;
}

// 계정 생성
async function createAccount() {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, TEST_USER);
    if (response.status === 201 || response.status === 200) {
      console.log('✅ 계정 생성 성공');
      return await login();
    }
  } catch (error) {
    console.error('❌ 계정 생성 실패:', error.message);
  }
  return false;
}

// 테스트용 포스트 생성
async function createTestPost() {
  try {
    const response = await axios.post(`${API_URL}/posts`, {
      title: `Load Test Post ${Date.now()}`,
      content: 'This is a test post for concurrent load testing.',
      tags: ['test', 'load', 'concurrent']
    }, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 201) {
      console.log('✅ 테스트 포스트 생성:', response.data.id);
      return response.data.id;
    }
  } catch (error) {
    console.error('❌ 포스트 생성 실패:', error.message);
  }
  return null;
}

// 좋아요 토글 (동시성 테스트 핵심)
async function toggleLike(postId) {
  const startTime = Date.now();
  stats.totalRequests++;
  
  try {
    const response = await axios.post(
      `${API_URL}/posts/${postId}/like`,
      {},
      {
        headers: {
          'Cookie': authCookie
        },
        timeout: 5000
      }
    );

    const responseTime = Date.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.successfulRequests++;
    
    return { success: true, responseTime };
  } catch (error) {
    stats.failedRequests++;
    const errorKey = error.message || 'Unknown';
    stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
    
    return { success: false, error: error.message };
  }
}

// 동시 요청 생성
async function generateConcurrentLoad(postId) {
  console.log(`\n🚀 ${NUM_CONCURRENT_REQUESTS}개의 동시 요청 시작...`);
  
  const promises = [];
  for (let i = 0; i < NUM_CONCURRENT_REQUESTS; i++) {
    promises.push(toggleLike(postId));
  }
  
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 성공: ${successful} / ❌ 실패: ${failed}`);
}

// 지속적인 부하 생성
async function continuousLoad(postId, durationMs) {
  console.log(`\n🔄 ${durationMs/1000}초 동안 지속적인 부하 테스트 시작...`);
  
  const endTime = Date.now() + durationMs;
  let batchCount = 0;
  
  while (Date.now() < endTime) {
    batchCount++;
    console.log(`\n배치 #${batchCount}`);
    await generateConcurrentLoad(postId);
    
    // 잠시 대기 (서버가 회복할 시간)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// 통계 출력
function printStats() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과 통계');
  console.log('='.repeat(50));
  console.log(`총 요청 수: ${stats.totalRequests}`);
  console.log(`성공: ${stats.successfulRequests} (${(stats.successfulRequests/stats.totalRequests*100).toFixed(2)}%)`);
  console.log(`실패: ${stats.failedRequests} (${(stats.failedRequests/stats.totalRequests*100).toFixed(2)}%)`);
  
  if (stats.responseTimes.length > 0) {
    const avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
    const maxResponseTime = Math.max(...stats.responseTimes);
    const minResponseTime = Math.min(...stats.responseTimes);
    
    console.log(`\n⏱️  응답 시간:`);
    console.log(`  평균: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  최소: ${minResponseTime}ms`);
    console.log(`  최대: ${maxResponseTime}ms`);
  }
  
  if (Object.keys(stats.errors).length > 0) {
    console.log(`\n❌ 에러 분석:`);
    for (const [error, count] of Object.entries(stats.errors)) {
      console.log(`  ${error}: ${count}회`);
    }
  }
  
  console.log('='.repeat(50));
}

// 메인 실행
async function main() {
  console.log('🔧 동시성 부하 테스트 시작...\n');
  
  // 1. 로그인
  if (!await login()) {
    console.error('로그인 실패. 테스트 중단.');
    return;
  }
  
  // 2. 테스트 포스트 생성
  const postId = await createTestPost();
  if (!postId) {
    console.error('포스트 생성 실패. 테스트 중단.');
    return;
  }
  
  // 3. 동시성 테스트 실행
  console.log('\n=== 단일 배치 동시성 테스트 ===');
  await generateConcurrentLoad(postId);
  
  // 통계 초기화
  stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errors: {},
    responseTimes: []
  };
  
  // 4. 지속적 부하 테스트
  console.log('\n=== 지속적 부하 테스트 ===');
  await continuousLoad(postId, TEST_DURATION_MS);
  
  // 5. 결과 출력
  printStats();
  
  console.log('\n✅ 테스트 완료!');
}

// 에러 처리
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  printStats();
  process.exit(1);
});

// 실행
main().catch(console.error);