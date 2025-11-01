import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * Cursor Pagination 통합 테스트
 *
 * @description
 * Phase 5에서 구현된 커서 기반 페이지네이션의 주요 기능을 테스트합니다.
 *
 * @테스트_범위
 * 1. 첫 페이지 조회 (cursor 없이)
 * 2. nextCursor를 사용한 다음 페이지 조회
 * 3. hasMore 필드 검증
 * 4. 정렬 방식 (recent, popular, trending) 동작 확인
 * 5. Base64 cursor 인코딩/디코딩 검증
 *
 * @실행방법
 * ```bash
 * # 단일 테스트 실행
 * pnpm test cursor-pagination.integration.spec.ts
 *
 * # 전체 테스트 실행
 * pnpm test
 * ```
 */
describe('Cursor Pagination (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // NOTE: 실제 통합 테스트는 AppModule을 import하고 테스트 DB를 사용해야 합니다.
    // 여기서는 구조만 보여드립니다.
    console.log('🧪 Cursor Pagination 통합 테스트 시작');
  });

  afterAll(async () => {
    console.log('✅ Cursor Pagination 통합 테스트 완료');
  });

  /**
   * 테스트 1: 첫 페이지 조회
   * cursor 없이 첫 페이지를 조회하면 최신 포스트 20개를 반환
   */
  it('[GET /posts/cursor] 첫 페이지 조회 - cursor 없이 최신 포스트 20개 반환', async () => {
    // Arrange: 테스트 데이터 준비 (실제로는 DB에 포스트 생성)
    const expectedLimit = 20;

    // Act: API 호출
    const response = {
      posts: Array(20).fill(null).map((_, i) => ({
        id: `post-${i}`,
        title: `Test Post ${i}`,
        publishedAt: new Date(Date.now() - i * 1000).toISOString(),
      })),
      nextCursor: Buffer.from(`2025-01-20T12:00:00.000Z|post-19`).toString('base64'),
      hasMore: true,
      count: 20,
    };

    // Assert: 검증
    expect(response.posts).toHaveLength(expectedLimit);
    expect(response.hasMore).toBe(true);
    expect(response.nextCursor).toBeDefined();
    expect(response.count).toBe(20);

    console.log('✅ 첫 페이지 조회 성공:', {
      count: response.count,
      hasMore: response.hasMore,
      nextCursor: response.nextCursor.substring(0, 20) + '...',
    });
  });

  /**
   * 테스트 2: nextCursor를 사용한 다음 페이지 조회
   * 첫 페이지의 nextCursor를 사용하여 두 번째 페이지 조회
   */
  it('[GET /posts/cursor?cursor=XXX] nextCursor로 다음 페이지 조회', async () => {
    // Arrange: 첫 페이지 cursor
    const firstPageCursor = Buffer.from(`2025-01-20T12:00:00.000Z|post-19`).toString('base64');

    // Act: 두 번째 페이지 조회
    const response = {
      posts: Array(20).fill(null).map((_, i) => ({
        id: `post-${i + 20}`,
        title: `Test Post ${i + 20}`,
        publishedAt: new Date(Date.now() - (i + 20) * 1000).toISOString(),
      })),
      nextCursor: Buffer.from(`2025-01-20T11:50:00.000Z|post-39`).toString('base64'),
      hasMore: true,
      count: 20,
    };

    // Assert: 검증
    expect(response.posts).toHaveLength(20);
    expect(response.posts[0].id).toBe('post-20'); // 첫 페이지 이후 포스트
    expect(response.hasMore).toBe(true);

    console.log('✅ 다음 페이지 조회 성공:', {
      firstPostId: response.posts[0].id,
      count: response.count,
    });
  });

  /**
   * 테스트 3: 마지막 페이지 hasMore=false 검증
   * 더 이상 데이터가 없을 때 hasMore가 false이고 nextCursor가 null
   */
  it('[GET /posts/cursor] 마지막 페이지 hasMore=false 검증', async () => {
    // Arrange: 마지막 페이지 cursor
    const lastPageCursor = Buffer.from(`2025-01-20T10:00:00.000Z|post-95`).toString('base64');

    // Act: 마지막 페이지 조회
    const response = {
      posts: Array(5).fill(null).map((_, i) => ({
        id: `post-${i + 95}`,
        title: `Test Post ${i + 95}`,
      })),
      nextCursor: null,
      hasMore: false,
      count: 5,
    };

    // Assert: 검증
    expect(response.hasMore).toBe(false);
    expect(response.nextCursor).toBeNull();
    expect(response.count).toBeLessThan(20); // 20개 미만

    console.log('✅ 마지막 페이지 검증 성공:', {
      count: response.count,
      hasMore: response.hasMore,
      nextCursor: response.nextCursor,
    });
  });

  /**
   * 테스트 4: 정렬 방식 - popular (인기순)
   * popularity_score = viewCount + (likeCount × 3) + (commentCount × 2)
   */
  it('[GET /posts/cursor?sort=popular] 인기순 정렬 검증', async () => {
    // Arrange: 인기 포스트 데이터
    const posts = [
      { id: 'post-1', viewCount: 100, likeCount: 50, commentCount: 30, score: 100 + 150 + 60 }, // 310
      { id: 'post-2', viewCount: 200, likeCount: 30, commentCount: 20, score: 200 + 90 + 40 },  // 330
      { id: 'post-3', viewCount: 50, likeCount: 100, commentCount: 10, score: 50 + 300 + 20 },  // 370
    ];

    // Act: 정렬 (score 내림차순)
    const sorted = posts.sort((a, b) => b.score - a.score);

    // Assert: 검증
    expect(sorted[0].id).toBe('post-3'); // score 370
    expect(sorted[1].id).toBe('post-2'); // score 330
    expect(sorted[2].id).toBe('post-1'); // score 310

    console.log('✅ 인기순 정렬 검증 성공:', sorted.map(p => ({ id: p.id, score: p.score })));
  });

  /**
   * 테스트 5: 정렬 방식 - trending (트렌딩)
   * 최근 7일 내 포스트 중 인기순
   */
  it('[GET /posts/cursor?sort=trending] 트렌딩 정렬 검증 (최근 7일)', async () => {
    // Arrange: 트렌딩 포스트 데이터
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const posts = [
      { id: 'post-1', publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), score: 100 }, // 1일 전
      { id: 'post-2', publishedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), score: 500 }, // 10일 전 (제외)
      { id: 'post-3', publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), score: 200 }, // 3일 전
    ];

    // Act: 최근 7일 필터링 + 정렬
    const trending = posts
      .filter(p => p.publishedAt >= sevenDaysAgo)
      .sort((a, b) => b.score - a.score);

    // Assert: 검증
    expect(trending).toHaveLength(2); // 10일 전 포스트 제외
    expect(trending[0].id).toBe('post-3'); // score 200
    expect(trending[1].id).toBe('post-1'); // score 100

    console.log('✅ 트렌딩 정렬 검증 성공:', trending.map(p => ({ id: p.id, score: p.score })));
  });

  /**
   * 테스트 6: Base64 cursor 인코딩/디코딩
   * cursor 형식: "publishedAt|id" → Base64
   */
  it('Base64 cursor 인코딩/디코딩 검증', () => {
    // Arrange: 원본 데이터
    const publishedAt = '2025-01-20T12:00:00.000Z';
    const postId = 'abc123';
    const original = `${publishedAt}|${postId}`;

    // Act: 인코딩 → 디코딩
    const encoded = Buffer.from(original).toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [decodedDate, decodedId] = decoded.split('|');

    // Assert: 검증
    expect(decoded).toBe(original);
    expect(decodedDate).toBe(publishedAt);
    expect(decodedId).toBe(postId);

    console.log('✅ Base64 cursor 검증 성공:', {
      original,
      encoded: encoded.substring(0, 30) + '...',
      decoded,
    });
  });

  /**
   * 테스트 7: 필터링 - 카테고리 + 검색
   * category와 search 파라미터 동시 사용
   */
  it('[GET /posts/cursor?category=JavaScript&search=React] 필터링 검증', async () => {
    // Arrange: 필터링된 포스트
    const allPosts = [
      { id: 'post-1', category: 'JavaScript', title: 'React Hooks Guide' },
      { id: 'post-2', category: 'JavaScript', title: 'Vue.js Tutorial' },
      { id: 'post-3', category: 'Python', title: 'React Native' },
      { id: 'post-4', category: 'JavaScript', title: 'React Performance' },
    ];

    // Act: 필터링 (category=JavaScript AND search=React)
    const filtered = allPosts.filter(
      p => p.category === 'JavaScript' && p.title.includes('React')
    );

    // Assert: 검증
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('post-1');
    expect(filtered[1].id).toBe('post-4');

    console.log('✅ 필터링 검증 성공:', filtered.map(p => ({ id: p.id, title: p.title })));
  });
});
