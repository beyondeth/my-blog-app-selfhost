import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 블로그 브랜딩 필드 추가 마이그레이션
 *
 * 변경사항:
 * - blogs 테이블에 로고 URL (logoUrl) 필드 추가
 * - blogs 테이블에 아이콘 URL (iconUrl) 필드 추가
 * - blogs 테이블에 커버 이미지 URL (coverImageUrl) 필드 추가
 * - blogs 테이블에 브랜드 색상 (brandColor) 필드 추가
 *
 * 용도:
 * - 개인 블로그 브랜딩 지원 (커뮤니티와 동일한 수준)
 * - 로고: 블로그 헤더에 표시
 * - 아이콘: 파비콘 및 목록 썸네일
 * - 커버 이미지: 블로그 홈페이지 헤더 배경
 * - 브랜드 색상: 블로그 테마 색상
 */
export class AddBlogBrandingFields1782000000002 implements MigrationInterface {
  name = "AddBlogBrandingFields1782000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 로고 URL 필드 추가
    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "logoUrl" VARCHAR(500)
    `);

    // 2. 아이콘 URL 필드 추가
    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "iconUrl" VARCHAR(500)
    `);

    // 3. 커버 이미지 URL 필드 추가
    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "coverImageUrl" VARCHAR(500)
    `);

    // 4. 브랜드 색상 필드 추가 (HEX 코드: #RRGGBB)
    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "brandColor" VARCHAR(7)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 필드 삭제 (역순)
    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "brandColor"
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "coverImageUrl"
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "iconUrl"
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "logoUrl"
    `);
  }
}
