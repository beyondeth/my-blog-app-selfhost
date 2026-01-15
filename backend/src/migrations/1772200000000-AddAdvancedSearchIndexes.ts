import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvancedSearchIndexes1772200000000
  implements MigrationInterface
{
  name = "AddAdvancedSearchIndexes1772200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 전문 검색 GIN 인덱스 최적화 (title + content 합칩 벡터)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_fulltext_enhanced
            ON posts USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '')))
            WHERE "isPublished" = true AND "isDeleted" = false
        `);

    // 2. 제목만 전문 검색 (더 빠른 제목 전용 검색)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_title_search
            ON posts USING GIN (to_tsvector('simple', COALESCE(title, '')))
            WHERE "isPublished" = true AND "isDeleted" = false
        `);

    // 3. 카테고리 + 전문 검색 조합 (카테고리별 검색)
    // PostgreSQL 인덱스 크기 제한 문제로 분리된 인덱스 생성
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_category
            ON posts("category")
            WHERE "isPublished" = true AND "isDeleted" = false AND "category" IS NOT NULL
        `);

    // 4. Posts에 트리거 자동 업데이트용 함수 생성 (전문 검색 벡터 자동 업데이트)
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_post_search_vector()
            RETURNS TRIGGER AS $$
            BEGIN
                UPDATE posts
                SET search_vector = to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''))
                WHERE id = NEW.id;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

    // 5. 전문 검색 벡터 자동 업데이트 트리거
    // PostgreSQL에서는 CREATE TRIGGER IF NOT EXISTS를 지원하지 않음
    // 수동으로 트리거 존재 여부를 확인하고 생성
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS trigger_post_search_vector_update ON posts
        `);
    await queryRunner.query(`
            CREATE TRIGGER trigger_post_search_vector_update
                AFTER INSERT OR UPDATE ON posts
                FOR EACH ROW
                EXECUTE FUNCTION update_post_search_vector()
        `);

    // 6. PostsMetadata 태그 검색 최적화 (GIN 인덱스)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_metadata_tags_gin
            ON post_metadata USING GIN (tags)
        `);

    // 7. PostsMetadata 카테고리 + 에디터픽 복합 인덱스
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_metadata_category_editor
            ON post_metadata("category", "isEditorPick", "editorPickedAt" DESC, "tags")
            WHERE "postId" IS NOT NULL
        `);

    // 8. Notification 테이블 최적화 (실시간 알림 성능)

    // 9. 수신자별 미확인 알림 조회
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_unread
            ON notifications(recipient_id, read, "createdAt" DESC)
            WHERE read = false
        `);

    // 10. 알림 타입별 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_type_created
            ON notifications(type, "createdAt" DESC)
        `);

    // 11. 대화(채팅) 관련 인덱스

    // 12. 대화 목록 최신 메시지 기준 정렬
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_conversations_last_msg
            ON conversations("user1Id", "user2Id", "lastMessageAt" DESC)
        `);

    // 13. 메시지 대화별 시간 순 정렬
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_time
            ON messages("conversationId", "createdAt" DESC)
        `);

    // 14. 메시지 테이블에는 isRead 컬럼이 없으므로 해당 인덱스 생성 건너뜀
    // 참고: messages 테이블 스키마에는 isRead 컬럼이 존재하지 않음

    // 15. 구독/차단 관계 인덱스 (차단 방지 및 성능 최적화)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_user_blocks_unique
            ON user_blocks("blockerId", "blockedId", "createdAt" DESC)
        `);

    // 16. Report 테이블 최적화 (신고 기능 성능)

    // 17. 미처리 신고 우선순위별 인덱스
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_reports_priority_status
            ON reports("priority", "status", "createdAt" DESC)
            WHERE "status" = 'pending'
        `);

    // 18. 신고된 콘텐트 타입별 그룹화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_reports_type_created
            ON reports("type", "createdAt" DESC)
        `);

    // 19. Audit 로그 성능 최적화 (감사 추적)

    // 20. 특정 사용자 액션 로그 추적
    // PostgreSQL partial index에서는 NOW()와 같은 volatile 함수를 사용할 수 없음
    // 대신 일반 인덱스를 생성하고 애플리케이션 레벨에서 필터링
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action
            ON audit_logs("performedById", "action", "createdAt" DESC)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 및 함수 삭제 (역순)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_user_action`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reports_type_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reports_priority_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_blocks_unique`);
    // idx_messages_unread_count 인덱스는 생성되지 않았으므로 제거 (messages.isRead 컬럼 없음)
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_messages_conversation_time`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_last_msg`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_notifications_type_created`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_unread`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_post_search_vector_update`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_post_search_vector()`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_post_metadata_category_editor`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_metadata_tags_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_category`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_title_search`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_fulltext_enhanced`);
  }
}
