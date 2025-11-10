import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTagListToTagsInPostMetadata1761700000000 implements MigrationInterface {
  name = 'RenameTagListToTagsInPostMetadata1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 사전 검증: post_metadata 테이블과 tagList 컬럼이 존재하는지 확인
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'post_metadata'
      )
    `);

    if (!tableExists[0].exists) {
      throw new Error('post_metadata table does not exist. Cannot perform migration.');
    }

    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'post_metadata'
        AND column_name = 'tagList'
      )
    `);

    if (!columnExists[0].exists) {
      // 이미 tags 컬럼이 존재하는지 확인 (이미 수동으로 수정된 경우)
      const tagsColumnExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'post_metadata'
          AND column_name = 'tags'
        )
      `);

      if (tagsColumnExists[0].exists) {
        console.log('[Migration] tags column already exists in post_metadata table. Skipping migration.');
        return;
      }

      throw new Error('tagList column does not exist in post_metadata table and tags column also does not exist. Migration cannot proceed.');
    }

    // 2. 데이터 백업 (안전장치)
    console.log('[Migration] Creating backup of tagList data from post_metadata...');
    await queryRunner.query(`
      CREATE TEMP TABLE temp_post_metadata_taglist_backup AS
      SELECT id, "tagList" FROM "post_metadata"
      WHERE "tagList" IS NOT NULL
    `);

    // 3. tagList 컬럼의 데이터 타입과 기본값 확인
    const columnInfo = await queryRunner.query(`
      SELECT data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'post_metadata'
      AND column_name = 'tagList'
    `);

    if (columnInfo.length > 0) {
      console.log(`[Migration] Current tagList column info in post_metadata:`);
      console.log(`  - Type: ${columnInfo[0].data_type}`);
      console.log(`  - Default: ${columnInfo[0].column_default}`);
      console.log(`  - Nullable: ${columnInfo[0].is_nullable}`);
    }

    // 4. 컬럼 이름 변경 (트랜잭션 내에서 실행)
    console.log('[Migration] Renaming tagList column to tags in post_metadata table...');
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      RENAME COLUMN "tagList" TO "tags"
    `);

    // 5. 사후 검증: 변경된 컬럼 확인
    const verifyRename = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'post_metadata'
        AND column_name = 'tags'
      )
    `);

    if (!verifyRename[0].exists) {
      throw new Error('Failed to rename column in post_metadata. tags column does not exist after migration.');
    }

    // 6. 데이터 무결성 검증
    const dataCheck = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "post_metadata"
      WHERE "tags" IS NOT NULL
    `);

    console.log(`[Migration] Post metadata records with tags: ${dataCheck[0].count}`);

    // 7. 인덱스 확인 (필요시 재생성)
    // tagList에 인덱스가 있었다면 tags 컬럼에도 인덱스가 자동으로 유지됨
    const indexExists = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'post_metadata'
      AND indexname LIKE '%tag%'
    `);

    if (indexExists.length > 0) {
      console.log('[Migration] Found indexes related to tags:', indexExists.map(idx => idx.indexname));
    }

    // 8. 임시 백업 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS temp_post_metadata_taglist_backup`);

    console.log('[Migration] Successfully renamed tagList to tags column in post_metadata table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 사전 검증: post_metadata 테이블과 tags 컬럼이 존재하는지 확인
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'post_metadata'
      )
    `);

    if (!tableExists[0].exists) {
      throw new Error('post_metadata table does not exist. Cannot rollback migration.');
    }

    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'post_metadata'
        AND column_name = 'tags'
      )
    `);

    if (!columnExists[0].exists) {
      // 이미 tagList 컬럼이 존재하는지 확인
      const tagListColumnExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'post_metadata'
          AND column_name = 'tagList'
        )
      `);

      if (tagListColumnExists[0].exists) {
        console.log('[Rollback] tagList column already exists in post_metadata table. Skipping rollback.');
        return;
      }

      throw new Error('tags column does not exist in post_metadata table and tagList column also does not exist. Rollback cannot proceed.');
    }

    // 2. 데이터 백업
    console.log('[Rollback] Creating backup of tags data from post_metadata...');
    await queryRunner.query(`
      CREATE TEMP TABLE temp_post_metadata_tags_backup AS
      SELECT id, "tags" FROM "post_metadata"
      WHERE "tags" IS NOT NULL
    `);

    // 3. 컬럼 이름 롤백
    console.log('[Rollback] Renaming tags column back to tagList in post_metadata table...');
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      RENAME COLUMN "tags" TO "tagList"
    `);

    // 4. 롤백 검증
    const verifyRollback = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'post_metadata'
        AND column_name = 'tagList'
      )
    `);

    if (!verifyRollback[0].exists) {
      throw new Error('Failed to rollback column in post_metadata. tagList column does not exist after rollback.');
    }

    // 5. 데이터 무결성 검증
    const dataCheck = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "post_metadata"
      WHERE "tagList" IS NOT NULL
    `);

    console.log(`[Rollback] Post metadata records with tagList: ${dataCheck[0].count}`);

    // 6. 임시 백업 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS temp_post_metadata_tags_backup`);

    console.log('[Rollback] Successfully rolled back tags to tagList column in post_metadata table');
  }
}