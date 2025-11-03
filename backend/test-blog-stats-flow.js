#!/usr/bin/env node

/**
 * 간단한 블로그 통계 흐름 테스트 스크립트
 * 이 스크립트는 BlogResolverService와 BlogStatsService의 핵심 기능을 테스트합니다
 */

const { execSync } = require('child_process');
const axios = require('axios');

async function testBlogStatsFlow() {
  console.log('🚀 블로그 통계 흐름 테스트 시작...\n');

  try {
    // 1. 서버 상태 확인
    console.log('1️⃣ 서버 상태 확인...');
    const healthResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 })
      .catch(() => {
        console.log('❌ 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
        process.exit(1);
      });

    console.log('✅ 서버가 실행 중입니다.\n');

    // 2. 테스트용 블로그 식별자 (기존 데이터 사용)
    const testIdentifier = 'luticek-seqn';
    console.log(`2️⃣ 테스트용 블로그 식별자: ${testIdentifier}`);

    // 3. 블로그 해석 테스트
    console.log('3️⃣ BlogResolverService 테스트...');
    try {
      const resolveResponse = await axios.get(`http://localhost:3000/api/v1/test/blog-resolver/${testIdentifier}`);
      console.log('✅ BlogResolverService 성공:', resolveResponse.data);
    } catch (error) {
      console.log('⚠️ BlogResolverService 테스트 실패 (예상된 결과):', error.response?.data || error.message);
    }

    // 4. 블로그 통계 테스트
    console.log('\n4️⃣ BlogStatsService 테스트...');
    try {
      const statsResponse = await axios.get(`http://localhost:3000/api/v1/test/blog-stats/${testIdentifier}`);
      console.log('✅ BlogStatsService 성공:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('⚠️ BlogStatsService 테스트 실패 (예상된 결과):', error.response?.data || error.message);
    }

    // 5. Redis 캐시 테스트
    console.log('\n5️⃣ Redis 캐시 테스트...');
    try {
      const cacheResponse = await axios.get(`http://localhost:3000/api/v1/test/redis-test`);
      console.log('✅ Redis 테스트 성공:', cacheResponse.data);
    } catch (error) {
      console.log('⚠️ Redis 테스트 실패:', error.response?.data || error.message);
    }

    // 6. 이벤트 발생 테스트
    console.log('\n6️⃣ 이벤트 시스템 테스트...');
    try {
      const eventResponse = await axios.post(`http://localhost:3000/api/v1/test/emit-event`, {
        eventType: 'blog.stats.updated',
        data: {
          blogId: 'test-blog-id',
          stats: { views: 100, likes: 10 }
        }
      });
      console.log('✅ 이벤트 발생 성공:', eventResponse.data);
    } catch (error) {
      console.log('⚠️ 이벤트 테스트 실패:', error.response?.data || error.message);
    }

    console.log('\n🎉 블로그 통계 흐름 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
testBlogStatsFlow();