import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Category 복합 인덱스 재생성 마이그레이션
 *
 * 문제 상황:
 * - 1758378537468-OptimizePostsTableIndexes: category 복합 인덱스 생성
 * - 1758384083910-DatabaseOptimization: "사용되지 않는 인덱스"로 잘못 판단하여 삭제
 * - 1761464987476-RemoveDuplicateCategoryIndex: 중복 단순 인덱스 제거 (이미 없었음)
 *
 * 현재 상태:
 * - category 관련 인덱스가 아예 존재하지 않음
 * - category 필드는 이제 NOT NULL 제약조건 추가됨 (MakeCategoryRequired1761200000000)
 *
 * 해결:
 * - category 쿼리 최적화를 위한 복합 인덱스 재생성
 * - (category, isPublished, publishedAt DESC) 조합으로 카테고리별 게시글 조회 성능 향상
 * - WHERE category IS NOT NULL 조건으로 부분 인덱스 구성 (이제 항상 NOT NULL이지만 안전성 확보)
 *
 * 성능 영향:
 * - 카테고리별 게시글 목록 조회 쿼리 성능 개선
 * - 공개된 게시글 중 특정 카테고리 필터링 시 인덱스 활용
 */
export class RecreateCategoryCompositeIndex1761465096433
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Category 복합 인덱스 재생성
    // 카테고리별로 공개된 게시글을 최신순으로 조회하는 쿼리 최적화
    await queryRunner.query(`
      CREATE INDEX "idx_posts_category_published"
      ON "posts"("category", "isPublished", "publishedAt" DESC)
      WHERE "category" IS NOT NULL
    `);

    // 통계 갱신으로 쿼리 플래너가 새 인덱스 활용
    await queryRunner.query(`ANALYZE posts`);

    console.log('✅ Category 복합 인덱스 재생성 완료: idx_posts_category_published');
    console.log('   - 구조: (category, isPublished, publishedAt DESC)');
    console.log('   - 부분 인덱스: WHERE category IS NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 복합 인덱스 제거
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_posts_category_published"
    `);

    console.log('⬇️  Rollback: Category 복합 인덱스 제거 완료');
  }
}
