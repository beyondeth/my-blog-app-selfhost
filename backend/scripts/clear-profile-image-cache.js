/**
 * 프로필 이미지 캐시 정리 스크립트
 *
 * 사용법:
 * node scripts/clear-profile-image-cache.js
 */

const redis = require('ioredis');

// 환경 변수에서 Redis 설정 가져오기
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
};

// Redis 클라이언트 생성
const redisClient = new redis(redisConfig);

async function clearProfileImageCache() {
  console.log('🧹 프로필 이미지 캐시 정리 시작...\n');

  try {
    // 연결 확인
    await redisClient.ping();
    console.log('✅ Redis 연결 성공');

    // 1. 홈피드 관련 캐시 삭제
    console.log('\n1️⃣ 홈피드 캐시 삭제 중...');
    const homeFeedKeys = await redisClient.keys('cache:feed:home:*');
    if (homeFeedKeys.length > 0) {
      await redisClient.del(...homeFeedKeys);
      console.log(`   - ${homeFeedKeys.length}개의 홈피드 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 홈피드 캐시 없음');
    }

    // 2. 인기 게시글 캐시 삭제
    console.log('\n2️⃣ 인기 게시글 캐시 삭제 중...');
    const popularKeys = await redisClient.keys('cache:feed:popular:*');
    if (popularKeys.length > 0) {
      await redisClient.del(...popularKeys);
      console.log(`   - ${popularKeys.length}개의 인기 게시글 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 인기 게시글 캐시 없음');
    }

    // Editor's Picks 캐시도 삭제
    console.log('\n2️⃣️⃣ Editor Picks 캐시 삭제 중...');
    const editorKeys = await redisClient.keys('cache:feed:editor-picks:*');
    if (editorKeys.length > 0) {
      await redisClient.del(...editorKeys);
      console.log(`   - ${editorKeys.length}개의 Editor Picks 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 Editor Picks 캐시 없음');
    }

    // 3. 블로그 피드 캐시 삭제
    console.log('\n3️⃣ 블로그 피드 캐시 삭제 중...');
    const blogFeedKeys = await redisClient.keys('cache:feed:blog:*');
    if (blogFeedKeys.length > 0) {
      await redisClient.del(...blogFeedKeys);
      console.log(`   - ${blogFeedKeys.length}개의 블로그 피드 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 블로그 피드 캐시 없음');
    }

    // 4. 포스트 코어 데이터 캐시 삭제 (profileImage 포함)
    console.log('\n4️⃣ 포스트 코어 데이터 캐시 삭제 중...');
    const postCoreKeys = await redisClient.keys('cache:post:core:*');
    if (postCoreKeys.length > 0) {
      // 너무 많으면 한 번에 100개씩 삭제
      const batchSize = 100;
      for (let i = 0; i < postCoreKeys.length; i += batchSize) {
        const batch = postCoreKeys.slice(i, i + batchSize);
        await redisClient.del(...batch);
        console.log(`   - ${Math.min(i + batchSize, postCoreKeys.length)}/${postCoreKeys.length} 포스트 캐시 삭제 중...`);
      }
      console.log(`   - 총 ${postCoreKeys.length}개의 포스트 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 포스트 캐시 없음');
    }

    // 5. 블로그 캐시 삭제
    console.log('\n5️⃣ 블로그 캐시 삭제 중...');
    const blogKeys = await redisClient.keys('cache:blog:*');
    if (blogKeys.length > 0) {
      await redisClient.del(...blogKeys);
      console.log(`   - ${blogKeys.length}개의 블로그 캐시 삭제 완료`);
    } else {
      console.log('   - 삭제할 블로그 캐시 없음');
    }

    console.log('\n✅ 모든 캐시 정리 완료!');
    console.log('\n📝 정리 내역:');
    console.log(`   - 홈피드: ${homeFeedKeys.length}개`);
    console.log(`   - 인기 게시글: ${popularKeys.length}개`);
    console.log(`   - 블로그 피드: ${blogFeedKeys.length}개`);
    console.log(`   - 포스트 데이터: ${postCoreKeys.length}개`);
    console.log(`   - 블로그 데이터: ${blogKeys.length}개`);
    console.log(`\n총 ${homeFeedKeys.length + popularKeys.length + blogFeedKeys.length + postCoreKeys.length + blogKeys.length}개의 캐시가 삭제되었습니다.`);

  } catch (error) {
    console.error('❌ 캐시 정리 중 오류 발생:', error);
  } finally {
    // 연결 종료
    await redisClient.quit();
    console.log('\n🔌 Redis 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  clearProfileImageCache();
}

module.exports = clearProfileImageCache;