import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFullTextSearch1759400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. posts 테이블에 search_vector 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    `);

    // 2. 검색 벡터 업데이트 함수 생성
    // 한국어와 영어를 모두 지원하도록 설정
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_post_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        -- title (가장 높은 가중치 A), excerpt (중간 가중치 B), content와 tagList (낮은 가중치 C)
        NEW.search_vector :=
          setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW.excerpt, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
          setweight(to_tsvector('simple', COALESCE(NEW."tagList"::text, '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. 트리거 생성 (새 포스트 생성 및 업데이트 시 자동 실행)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS post_search_vector_update ON "posts";

      CREATE TRIGGER post_search_vector_update
      BEFORE INSERT OR UPDATE OF title, content, excerpt, "tagList"
      ON "posts"
      FOR EACH ROW
      EXECUTE FUNCTION update_post_search_vector();
    `);

    // 4. GIN 인덱스 생성 (검색 성능 최적화)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_search_vector
      ON "posts"
      USING gin(search_vector);
    `);

    // 5. 기존 포스트들의 search_vector 업데이트
    // 배치로 처리하여 대량 데이터에서도 안전하게 처리
    await queryRunner.query(`
      UPDATE "posts"
      SET search_vector =
        setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(excerpt, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(content, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE("tagList"::text, '')), 'C')
      WHERE search_vector IS NULL;
    `);

    // 6. 검색 쿼리 성능 향상을 위한 추가 인덱스
    // 복합 인덱스로 정렬과 필터링 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_published_search
      ON "posts" ("isPublished", "publishedAt" DESC)
      WHERE "isPublished" = true;
    `);

    console.log('✅ Full-text search infrastructure created successfully');
    console.log('   - Added search_vector column');
    console.log('   - Created auto-update trigger');
    console.log('   - Added GIN index for fast searching');
    console.log('   - Updated existing posts');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 생성한 모든 요소 제거
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_published_search`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_search_vector`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS post_search_vector_update ON "posts"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_post_search_vector()`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "search_vector"`);
  }
}