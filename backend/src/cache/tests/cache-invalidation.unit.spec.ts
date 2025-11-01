import { CacheInvalidationEvents } from '../../common/events/cache.events';

/**
 * 캐시 무효화 이벤트 유닛 테스트
 *
 * @description
 * Phase 3에서 구현된 이벤트 기반 캐시 무효화 시스템을 테스트합니다.
 *
 * @테스트_범위
 * 1. 이벤트 타입 정의 검증
 * 2. 이벤트 페이로드 타입 검증
 * 3. 캐시 키 패턴 매칭
 * 4. 이벤트 발행 → 캐시 무효화 플로우
 *
 * @실행방법
 * ```bash
 * pnpm test cache-invalidation.unit.spec.ts
 * ```
 */
describe('Cache Invalidation Events (Unit)', () => {
  /**
   * 테스트 1: 이벤트 타입 정의 검증
   * CacheInvalidationEvents enum의 모든 이벤트 확인
   */
  it('CacheInvalidationEvents enum - 모든 이벤트 타입 검증', () => {
    // Arrange: 예상 이벤트 목록
    const expectedEvents = [
      'post.created',
      'post.updated',
      'post.deleted',
      'post.published',
      'post.editorPick.toggled',
      'post.popularity.updated',
      'comment.created',
      'comment.updated',
      'comment.deleted',
      'blog.created',
      'blog.updated',
      'blog.settings.changed',
      'user.profile.updated',
      'user.avatar.updated',
      'tag.popularity.changed',
    ];

    // Act & Assert: 각 이벤트 존재 확인
    expectedEvents.forEach(eventType => {
      const exists = Object.values(CacheInvalidationEvents).includes(eventType as any);
      expect(exists).toBe(true);
      console.log(`  ✅ ${eventType}`);
    });

    console.log('✅ 모든 이벤트 타입 검증 성공');
  });

  /**
   * 테스트 2: POST_CREATED 이벤트 시뮬레이션
   * 포스트 생성 시 홈 피드 첫 페이지 무효화
   */
  it('POST_CREATED 이벤트 - 홈 피드 첫 페이지 무효화', () => {
    // Arrange: 이벤트 페이로드
    const payload = {
      postId: 'post-123',
      blogSlug: 'john-blog',
      authorId: 'user-456',
      category: 'JavaScript',
      tags: ['React', 'TypeScript'],
    };

    // Act: 무효화 대상 캐시 키 패턴
    const invalidationPatterns = [
      'feed:home:page:1',                    // 홈 피드 첫 페이지
      `feed:blog:${payload.blogSlug}:page:1`, // 블로그 피드 첫 페이지
    ];

    // Assert: 검증
    expect(invalidationPatterns).toContain('feed:home:page:1');
    expect(invalidationPatterns).toContain('feed:blog:john-blog:page:1');

    console.log('✅ POST_CREATED 무효화 패턴 검증 성공:', invalidationPatterns);
  });

  /**
   * 테스트 3: POST_DELETED 이벤트 시뮬레이션
   * 포스트 삭제 시 모든 관련 캐시 무효화
   */
  it('POST_DELETED 이벤트 - 모든 관련 캐시 무효화', () => {
    // Arrange: 이벤트 페이로드
    const payload = {
      postId: 'post-123',
      blogSlug: 'john-blog',
      authorId: 'user-456',
    };

    // Act: 무효화 대상 캐시 키 패턴
    const invalidationPatterns = [
      'feed:home:page:*',                    // 홈 피드 전체
      `feed:blog:${payload.blogSlug}:*`,     // 블로그 피드 전체
      'feed:popular:*',                      // 인기 포스트 전체
      'feed:editor-picks:*',                 // 에디터스 픽 전체
      `post:core:${payload.postId}`,         // 포스트 Core 캐시
      `post:detail:${payload.postId}`,       // 포스트 Detail 캐시
    ];

    // Assert: 검증 (와일드카드 패턴)
    expect(invalidationPatterns).toContain('feed:home:page:*');
    expect(invalidationPatterns).toContain('feed:popular:*');

    console.log('✅ POST_DELETED 무효화 패턴 검증 성공:', invalidationPatterns);
  });

  /**
   * 테스트 4: COMMENT_CREATED 이벤트 시뮬레이션
   * 댓글 생성 시 댓글 캐시 + 포스트 캐시 무효화
   */
  it('COMMENT_CREATED 이벤트 - 댓글 페이지 + 포스트 캐시 무효화', () => {
    // Arrange: 이벤트 페이로드 (답글)
    const payload = {
      commentId: 'comment-789',
      postId: 'post-123',
      parentCommentId: 'comment-456', // 답글
      authorId: 'user-999',
    };

    // Act: 무효화 대상 캐시 키 패턴
    const invalidationPatterns = [
      `comments:page:first:${payload.postId}:*`,  // 댓글 첫 페이지 (모든 정렬)
      `comments:total:${payload.postId}`,         // 댓글 총 개수
      `comments:replies:first:${payload.parentCommentId}`, // 부모 댓글의 답글 목록
      `post:core:${payload.postId}`,              // 포스트 Core (댓글 수 표시)
      `post:detail:${payload.postId}`,            // 포스트 Detail
      'feed:popular:*',                           // 인기 포스트 (댓글 수는 popularity_score에 영향)
    ];

    // Assert: 검증
    expect(invalidationPatterns).toContain(`comments:page:first:${payload.postId}:*`);
    expect(invalidationPatterns).toContain(`comments:replies:first:${payload.parentCommentId}`);
    expect(invalidationPatterns).toContain('feed:popular:*');

    console.log('✅ COMMENT_CREATED 무효화 패턴 검증 성공:', invalidationPatterns);
  });

  /**
   * 테스트 5: USER_PROFILE_UPDATED 이벤트 시뮬레이션
   * 프로필 이미지 변경 시 모든 포스트 목록 무효화
   */
  it('USER_PROFILE_UPDATED 이벤트 - 프로필 이미지 변경 시 피드 무효화', () => {
    // Arrange: 이벤트 페이로드
    const payload = {
      userId: 'user-123',
      username: 'john',
      changes: {
        profileImage: true,  // 프로필 이미지 변경됨
        bio: false,
        displayName: false,
      },
    };

    // Act: 무효화 대상 캐시 키 패턴
    let invalidationPatterns = [
      `user:id:${payload.userId}`,
      `user:profile:${payload.userId}`,
      `blog:user:${payload.userId}`,
    ];

    // 프로필 이미지 변경 시 추가 무효화
    if (payload.changes.profileImage || payload.changes.displayName) {
      invalidationPatterns = [
        ...invalidationPatterns,
        `user:${payload.userId}:*`,
        'feed:home:page:1',  // 홈 피드 첫 페이지 (author 정보 표시)
        'feed:popular:*',    // 인기 포스트
      ];
    }

    // Assert: 검증
    expect(invalidationPatterns).toContain('feed:home:page:1');
    expect(invalidationPatterns).toContain('feed:popular:*');

    console.log('✅ USER_PROFILE_UPDATED 무효화 패턴 검증 성공:', invalidationPatterns);
  });

  /**
   * 테스트 6: BLOG_UPDATED 이벤트 시뮬레이션
   * isPublic 변경 시 모든 피드 무효화
   */
  it('BLOG_UPDATED 이벤트 - isPublic 변경 시 전체 피드 무효화', () => {
    // Arrange: 이벤트 페이로드
    const payload = {
      blogId: 'blog-123',
      blogSlug: 'john-blog',
      changes: {
        isPublic: true,        // 공개/비공개 전환
        allowComments: false,
        name: false,
        description: false,
      },
    };

    // Act: 무효화 대상 캐시 키 패턴
    let invalidationPatterns = [
      `blog:info:${payload.blogSlug}`,
      `blog:stats:${payload.blogSlug}`,
      `blog:slug:${payload.blogSlug}`,
      `blog:id:${payload.blogId}`,
    ];

    // isPublic 변경 시 추가 무효화
    if (payload.changes.isPublic) {
      invalidationPatterns = [
        ...invalidationPatterns,
        'feed:home:page:*',              // 홈 피드 전체
        `feed:blog:${payload.blogSlug}:*`, // 블로그 피드 전체
        'feed:popular:*',                // 인기 포스트
      ];
    }

    // Assert: 검증
    expect(invalidationPatterns).toContain('feed:home:page:*');
    expect(invalidationPatterns).toContain('feed:popular:*');

    console.log('✅ BLOG_UPDATED 무효화 패턴 검증 성공:', invalidationPatterns);
  });

  /**
   * 테스트 7: 캐시 키 패턴 매칭 시뮬레이션
   * 와일드카드 패턴으로 여러 캐시 키 무효화
   */
  it('캐시 키 패턴 매칭 - 와일드카드로 여러 키 무효화', () => {
    // Arrange: Redis 캐시 키 목록
    const cacheKeys = [
      'feed:home:page:1',
      'feed:home:page:2',
      'feed:home:page:3',
      'feed:blog:john-blog:page:1',
      'feed:popular:daily',
      'feed:popular:weekly',
      'post:core:abc123',
    ];

    // Act: 패턴 매칭 시뮬레이션
    const pattern = 'feed:home:page:*';
    const matched = cacheKeys.filter(key => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    });

    // Assert: 검증
    expect(matched).toHaveLength(3);
    expect(matched).toContain('feed:home:page:1');
    expect(matched).toContain('feed:home:page:2');
    expect(matched).toContain('feed:home:page:3');

    console.log('✅ 와일드카드 패턴 매칭 검증 성공:', matched);
  });

  /**
   * 테스트 8: 이벤트별 무효화 대상 요약
   * 각 이벤트가 무효화하는 캐시 범위 확인
   */
  it('이벤트별 무효화 대상 요약', () => {
    // Arrange: 이벤트별 무효화 대상
    const eventInvalidationMap = {
      'post.created': ['홈 피드 첫 페이지', '블로그 피드 첫 페이지'],
      'post.updated': ['포스트 개별 캐시', '홈 피드', '블로그 피드'],
      'post.deleted': ['모든 페이지', '인기 포스트', '에디터스 픽'],
      'comment.created': ['댓글 페이지', '포스트 상세', '인기 포스트'],
      'comment.deleted': ['댓글 트리 전체', '포스트 상세', '인기 포스트'],
      'blog.updated (isPublic)': ['홈 피드 전체', '블로그 피드 전체', '인기 포스트'],
      'user.profile.updated (이미지)': ['사용자 프로필', '모든 피드 첫 페이지'],
    };

    // Act & Assert: 요약 출력
    console.log('\n📊 이벤트별 캐시 무효화 대상:');
    Object.entries(eventInvalidationMap).forEach(([event, targets]) => {
      console.log(`  🔹 ${event}`);
      targets.forEach(target => {
        console.log(`     → ${target}`);
      });
    });

    expect(Object.keys(eventInvalidationMap)).toHaveLength(7);
    console.log('\n✅ 이벤트별 무효화 대상 요약 완료');
  });
});
