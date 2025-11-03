#!/bin/bash

# 블로그 통계 기능 테스트 스크립트

API_URL="http://localhost:3000/api/v1"
BLOG_IDENTIFIER="test-blog"  # 실제 존재하는 블로그 식별자로 변경 필요

echo "🧪 블로그 통계 기능 테스트 시작..."
echo "================================"

# 1. 블로그 통계 조회
echo ""
echo "1️⃣ 블로그 통계 조회 테스트"
curl -s "$API_URL/test/blog-stats/$BLOG_IDENTIFIER" | jq '.'

# 2. 캐시 상태 확인
echo ""
echo "2️⃣ 캐시 상태 확인"
curl -s "$API_URL/test/blog-stats/$BLOG_IDENTIFIER/cache" | jq '.'

# 3. UnifiedRedisService 기능 테스트
echo ""
echo "3️⃣ UnifiedRedisService 기능 테스트"
curl -s -X POST "$API_URL/test/blog-stats/redis/test" | jq '.'

# 4. 이벤트 발행 테스트
echo ""
echo "4️⃣ 포스트 생성 이벤트 발행"
curl -s -X POST "$API_URL/test/blog-stats/$BLOG_IDENTIFIER/event/post-created" | jq '.'

echo ""
echo "5️⃣ 포스트 업데이트 이벤트 발행"
curl -s -X POST "$API_URL/test/blog-stats/$BLOG_IDENTIFIER/event/post-updated" | jq '.'

# 5. 캐시 무효화 테스트
echo ""
echo "5️⃣ 캐시 무효화 테스트"
curl -s -X POST "$API_URL/test/blog-stats/$BLOG_IDENTIFIER/invalidate-cache" | jq '.'

# 6. 다시 통계 조회 (캐시 미스 확인)
echo ""
echo "6️⃣ 캐시 무효화 후 통계 재조회"
curl -s "$API_URL/test/blog-stats/$BLOG_IDENTIFIER" | jq '.'

echo ""
echo "✅ 테스트 완료!"
echo ""
echo "📝 확인사항:"
echo "  - BlogResolverService가 블로그 식별자를 올바르게 해결하는가?"
echo "  - BlogStatsService가 통계를 올바르게 계산하는가?"
echo "  - UnifiedRedisService가 캐시를 올바르게 관리하는가?"
echo "  - 이벤트가 핸들러에 의해 처리되는가?"
echo "  - 캐시 무효화가 작동하는가?"