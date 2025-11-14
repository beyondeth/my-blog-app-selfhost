import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRecursiveSearchTrigger1778000000000 implements MigrationInterface {
  name = 'RemoveRecursiveSearchTrigger1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 재귀 호출을 유발하는 검색 벡터 트리거 제거
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_post_search_vector_update ON posts
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_post_search_vector()
    `);

    console.log('Removed recursive search trigger and function to prevent stack overflow errors');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 트리거 복원 (하지만 재귀 문제를 피하기 위해 INSERT만 트리거)
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

    await queryRunner.query(`
      CREATE TRIGGER trigger_post_search_vector_update
          AFTER INSERT ON posts  -- UPDATE 제거하여 재귀 방지
          FOR EACH ROW
          EXECUTE FUNCTION update_post_search_vector()
    `);
  }
}