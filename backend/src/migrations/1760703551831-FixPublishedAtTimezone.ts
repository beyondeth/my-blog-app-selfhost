import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * publishedAt 컬럼의 timezone 문제 수정 Migration
 *
 * 문제:
 * - publishedAt에 KST 시간이 저장됨 (예: 2025-10-17 21:07:34)
 * - createdAt에는 UTC 시간이 저장됨 (예: 2025-10-17 12:07:34)
 * - TimezoneInterceptor가 KST 값에 +9시간 추가 → 미래 시간 표시
 *
 * 해결:
 * - 기존 publishedAt 값에서 9시간을 빼서 UTC로 정규화
 * - 예: 2025-10-17 21:07:34 → 2025-10-17 12:07:34
 */
export class FixPublishedAtTimezone1760703551831 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // publishedAt 값을 UTC로 변환 (9시간 빼기)
        await queryRunner.query(`
            UPDATE posts
            SET "publishedAt" = "publishedAt" - INTERVAL '9 hours'
            WHERE "publishedAt" IS NOT NULL;
        `);

        console.log('✅ publishedAt timestamps converted from KST to UTC');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: publishedAt 값을 다시 KST로 변환 (9시간 더하기)
        await queryRunner.query(`
            UPDATE posts
            SET "publishedAt" = "publishedAt" + INTERVAL '9 hours'
            WHERE "publishedAt" IS NOT NULL;
        `);

        console.log('✅ publishedAt timestamps reverted from UTC to KST');
    }

}
