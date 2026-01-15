import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerformanceOptimizationIndexes1772100000000
  implements MigrationInterface
{
  name = "AddPerformanceOptimizationIndexes1772100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users 테이블 인덱스 추가

    // 1. 활성 사용자 조회 최적화 (관리자 대시보드)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_active_role
            ON users("isActive", "role", "createdAt" DESC)
            WHERE "isActive" = true
        `);

    // 2. OAuth 제공자별 활성 사용자 조회
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_auth_provider
            ON users("authProvider", "isActive", "createdAt" DESC)
            WHERE "isActive" = true
        `);

    // 3. 최근 로그인 사용자 추적 (사용자 활동 분석용)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_last_login
            ON users("lastLoginAt" DESC NULLS LAST, "createdAt" DESC)
            WHERE "isActive" = true
        `);

    // Blogs 테이블 인덱스 추가

    // 4. 공개 블로그 발견 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_blogs_public_enhanced
            ON blogs("isPublic", "createdAt" DESC)
            WHERE "isPublic" = true
        `);

    // 5. 블로그 소유자 조회 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_blogs_owner
            ON blogs("userId", "createdAt" DESC)
        `);

    // 6. 블로그 별칭(alias) 조회 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_blogs_alias
            ON blogs("alias", "isPublic", "createdAt" DESC)
        `);

    // PostStats 테이블 인덱스 추가

    // 7. 인기도 통계 종합 인덱스 (조회수, 좋아요, 품질 점수)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_stats_popularity
            ON post_stats("viewCount", "likeCount", "qualityScore" DESC)
        `);

    // 8. 최신 업데이트 기준 통계 (최근 7일, 30일)
    // PostgreSQL partial index에서는 NOW()와 같은 volatile 함수를 사용할 수 없음
    // 대신 일반 인덱스를 생성하고 애플리케이션 레벨에서 필터링
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_stats_recent
            ON post_stats("updatedAt" DESC, "viewCount" DESC)
        `);

    // 9. 주간/일간 뷰 카운트 인덱스 (시간 기반 통계)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_stats_daily_views
            ON post_stats(DATE("updatedAt"), "viewCount")
        `);

    // File 엔티티 관련 인덱스 (미디어 콘텐트)

    // 10. 파일 사용자별 조회 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_files_user_created
            ON files(user_id, created_at DESC)
        `);

    // 11. 파일 컨텍스트별 조회 (특정 게시물/블로그의 파일)
    // Note: files 테이블은 context_type과 context_id 컬럼을 사용하지 않음
    // 대신 post_files 테이블을 통한 조인을 사용하므로 이 인덱스는 필요없음
    // await queryRunner.query(`
    //     CREATE INDEX IF NOT EXISTS idx_files_context
    //     ON files(context_type, context_id, created_at DESC)
    // `);

    // 12. 파일 타입 및 크기 기준 조회 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_files_type_size
            ON files(mime_type, file_size)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제 (역순)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_files_type_size`);
    // await queryRunner.query(`DROP INDEX IF EXISTS idx_files_context`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_files_user_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_stats_daily_views`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_stats_recent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_stats_popularity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_blogs_alias`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_blogs_owner`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_blogs_public_enhanced`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_last_login`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_auth_provider`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_active_role`);
  }
}
