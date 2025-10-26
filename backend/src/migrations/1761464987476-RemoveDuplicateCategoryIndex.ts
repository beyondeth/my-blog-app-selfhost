import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 중복된 category 단순 인덱스 제거 마이그레이션
 *
 * 배경:
 * - posts 테이블에 두 개의 category 인덱스 존재:
 *   1. IDX_c81be77ac4b528ea4f2c94fcfb (단순 B-tree on category)
 *   2. idx_posts_category_published (복합 B-tree on category, isPublished, publishedAt DESC)
 *
 * 목적:
 * - 복합 인덱스가 단순 인덱스의 모든 쿼리를 커버하므로 중복 제거
 * - 인덱스 유지 오버헤드 감소 (INSERT/UPDATE 성능 개선)
 * - 스토리지 절약
 *
 * 영향:
 * - 성능: 영향 없음 (복합 인덱스로 모든 category 쿼리 처리)
 * - 저장소: 인덱스 크기만큼 절약
 * - 쓰기 성능: 미세하게 개선 (인덱스 갱신 1개 감소)
 */
export class RemoveDuplicateCategoryIndex1761464987476
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 중복된 단순 category 인덱스 제거
    // 복합 인덱스 idx_posts_category_published가 모든 category 쿼리를 커버함
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_c81be77ac4b528ea4f2c94fcfb"
    `);

    console.log(
      '✅ 중복 category 인덱스 제거 완료: IDX_c81be77ac4b528ea4f2c94fcfb',
    );
    console.log(
      '   복합 인덱스 idx_posts_category_published로 모든 쿼리 처리',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 단순 인덱스 재생성
    await queryRunner.query(`
      CREATE INDEX "IDX_c81be77ac4b528ea4f2c94fcfb"
      ON "posts" ("category")
    `);

    console.log('⬇️  Rollback: 단순 category 인덱스 재생성 완료');
  }
}
