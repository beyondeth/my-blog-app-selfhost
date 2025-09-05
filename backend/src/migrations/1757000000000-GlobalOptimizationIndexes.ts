import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalOptimizationIndexes1757000000000 implements MigrationInterface {
  name = 'GlobalOptimizationIndexes1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting Global Optimization Indexes Migration...');

    // ====================================
    // 1. 시간 기반 쿼리 최적화 인덱스
    // ====================================
    console.log('Creating time-based query optimization indexes...');
    
    // Posts 테이블 - 공개된 포스트의 발행일 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_published_at 
      ON posts("publishedAt" DESC) 
      WHERE "isPublished" = true
    `);

    // Posts 테이블 - 블로그별 공개 포스트 복합 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_blog_published 
      ON posts("blogId", "isPublished", "publishedAt" DESC)
    `);

    // Posts 테이블 - 생성일 기반 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_created_at 
      ON posts("createdAt" DESC)
    `);

    // ====================================
    // 2. 사용자 활동 최적화 인덱스
    // ====================================
    console.log('Creating user activity optimization indexes...');
    
    // Users 테이블 - 마지막 로그인 시간 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_last_login 
      ON users("lastLoginAt" DESC) 
      WHERE "isActive" = true
    `);

    // Users 테이블 - OAuth 제공자별 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_auth_provider 
      ON users("authProvider", email)
    `);

    // ====================================
    // 3. 알림 시스템 최적화 인덱스
    // ====================================
    console.log('Creating notification system optimization indexes...');
    
    // Notifications 테이블 - 읽지 않은 알림 부분 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread 
      ON notifications(recipient_id, "createdAt" DESC) 
      WHERE read = false
    `);

    // Notifications 테이블 - 타입별 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_type 
      ON notifications(type, recipient_id, "createdAt" DESC)
    `);

    // ====================================
    // 4. 댓글 시스템 최적화 인덱스
    // ====================================
    console.log('Creating comment system optimization indexes...');
    
    // Comments 테이블 - 포스트별 댓글 정렬 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_created 
      ON comments("postId", "createdAt")
    `);

    // Comments 테이블 - 사용자별 댓글 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_author 
      ON comments("authorId", "createdAt" DESC)
    `);

    // Comments 테이블 - 대댓글 조회 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_parent 
      ON comments("parentCommentId") 
      WHERE "parentCommentId" IS NOT NULL
    `);

    // ====================================
    // 5. 파일 관리 최적화 인덱스
    // ====================================
    console.log('Creating file management optimization indexes...');
    
    // Files 테이블 - 사용자별 파일 타입 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_files_user_type_created 
      ON files(user_id, file_type, created_at DESC)
    `);

    // Files 테이블 - MIME 타입별 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_files_mime_type 
      ON files(mime_type, created_at DESC)
    `);

    // Files 테이블 - 최적화된 파일 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_files_optimized 
      ON files("isOptimized", created_at DESC) 
      WHERE "isOptimized" = false
    `);

    // ====================================
    // 6. 팔로우 시스템 최적화 인덱스
    // ====================================
    console.log('Creating follow system optimization indexes...');
    
    // Follows 테이블 - 팔로워 수 집계용 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_follows_following_created 
      ON follows(following_id, "createdAt" DESC)
    `);

    // ====================================
    // 7. API 키 관리 최적화 인덱스
    // ====================================
    console.log('Creating API key management optimization indexes...');
    
    // API Keys 테이블 - 활성 키 조회 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_active 
      ON api_keys("blogId", "isActive") 
      WHERE "isActive" = true
    `);

    // API Keys 테이블 - 마지막 사용 시간 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_last_used 
      ON api_keys("lastUsedAt" DESC) 
      WHERE "isActive" = true
    `);

    // ====================================
    // 8. 감사 로그 최적화 인덱스
    // ====================================
    console.log('Creating audit log optimization indexes...');
    
    // Audit Logs 테이블 - 시간 범위 조회 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_time_range 
      ON audit_logs("createdAt" DESC, action)
    `);

    // ====================================
    // 9. 보고서 시스템 최적화 인덱스
    // ====================================
    console.log('Creating report system optimization indexes...');
    
    // Reports 테이블 - 상태별 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_status 
      ON reports(status, "createdAt" DESC) 
      WHERE status != 'resolved'
    `);

    // ====================================
    // 10. 커버링 인덱스 (성능 극대화)
    // ====================================
    console.log('Creating covering indexes for maximum performance...');
    
    // Posts 테이블 - 목록 조회용 커버링 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_list_covering 
      ON posts("blogId", "isPublished", "publishedAt" DESC) 
      INCLUDE (title, thumbnail, "viewCount", "likeCount", "commentCount")
    `);

    // ====================================
    // 11. 통계 정보 갱신
    // ====================================
    console.log('Updating database statistics...');
    await queryRunner.query('ANALYZE posts');
    await queryRunner.query('ANALYZE users');
    await queryRunner.query('ANALYZE comments');
    await queryRunner.query('ANALYZE notifications');
    await queryRunner.query('ANALYZE files');
    await queryRunner.query('ANALYZE follows');

    console.log('✅ Global Optimization Indexes Migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back Global Optimization Indexes...');

    // Drop all created indexes in reverse order
    const indexesToDrop = [
      'idx_posts_list_covering',
      'idx_reports_status',
      'idx_audit_logs_time_range',
      'idx_api_keys_last_used',
      'idx_api_keys_active',
      'idx_follows_following_created',
      'idx_files_optimized',
      'idx_files_mime_type',
      'idx_files_user_type_created',
      'idx_comments_parent',
      'idx_comments_author',
      'idx_comments_post_created',
      'idx_notifications_type',
      'idx_notifications_unread',
      'idx_users_auth_provider',
      'idx_users_last_login',
      'idx_posts_created_at',
      'idx_posts_blog_published',
      'idx_posts_published_at'
    ];

    for (const indexName of indexesToDrop) {
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`Dropped index: ${indexName}`);
      } catch (error) {
        console.error(`Failed to drop index ${indexName}:`, error);
      }
    }

    console.log('✅ Rollback completed');
  }
}