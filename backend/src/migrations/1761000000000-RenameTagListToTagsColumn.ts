import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTagListToTagsColumn1761000000000 implements MigrationInterface {
  name = 'RenameTagListToTagsColumn1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 사전 검증: tagList 컬럼이 존재하는지 확인
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'tagList'
      )
    `);

    if (!tableExists[0].exists) {
      throw new Error('tagList column does not exist in posts table. Migration may have already been applied.');
    }

    // 2. 데이터 백업 (안전장치)
    console.log('[Migration] Creating backup of tagList data...');
    await queryRunner.query(`
      CREATE TEMP TABLE temp_taglist_backup AS
      SELECT id, "tagList" FROM "posts"
      WHERE "tagList" IS NOT NULL
    `);

    // 3. tagList 컬럼의 데이터 타입 확인
    const columnInfo = await queryRunner.query(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'posts'
      AND column_name = 'tagList'
    `);

    if (columnInfo.length > 0) {
      console.log(`[Migration] Current tagList column type: ${columnInfo[0].data_type}`);
    }

    // 4. 컬럼 이름 변경 (트랜잭션 내에서 실행)
    console.log('[Migration] Renaming tagList column to tags...');
    await queryRunner.query(`
      ALTER TABLE "posts"
      RENAME COLUMN "tagList" TO "tags"
    `);

    // 5. 사후 검증: 변경된 컬럼 확인
    const verifyRename = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'tags'
      )
    `);

    if (!verifyRename[0].exists) {
      throw new Error('Failed to rename column. tags column does not exist after migration.');
    }

    // 6. 데이터 무결성 검증
    const dataCheck = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "posts"
      WHERE "tags" IS NOT NULL
    `);

    console.log(`[Migration] Posts with tags: ${dataCheck[0].count}`);

    // 7. 임시 백업 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS temp_taglist_backup`);

    console.log('[Migration] Successfully renamed tagList to tags column');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 사전 검증: tags 컬럼이 존재하는지 확인
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'tags'
      )
    `);

    if (!tableExists[0].exists) {
      throw new Error('tags column does not exist in posts table. Rollback may have already been applied.');
    }

    // 2. 데이터 백업
    console.log('[Rollback] Creating backup of tags data...');
    await queryRunner.query(`
      CREATE TEMP TABLE temp_tags_backup AS
      SELECT id, "tags" FROM "posts"
      WHERE "tags" IS NOT NULL
    `);

    // 3. 컬럼 이름 롤백
    console.log('[Rollback] Renaming tags column back to tagList...');
    await queryRunner.query(`
      ALTER TABLE "posts"
      RENAME COLUMN "tags" TO "tagList"
    `);

    // 4. 롤백 검증
    const verifyRollback = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'posts'
        AND column_name = 'tagList'
      )
    `);

    if (!verifyRollback[0].exists) {
      throw new Error('Failed to rollback column. tagList column does not exist after rollback.');
    }

    // 5. 임시 백업 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS temp_tags_backup`);

    console.log('[Rollback] Successfully rolled back tags to tagList column');
  }
}