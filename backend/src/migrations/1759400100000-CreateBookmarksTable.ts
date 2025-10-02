import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBookmarksTable1759400100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // bookmarks 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'bookmarks',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'post_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_bookmark_user',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_bookmark_post',
            columnNames: ['post_id'],
            referencedTableName: 'posts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // 인덱스 생성 - 사용자별 최신순 조회 최적화
    await queryRunner.createIndex(
      'bookmarks',
      new TableIndex({
        name: 'idx_bookmark_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    // 인덱스 생성 - 포스트별 북마크 조회 최적화
    await queryRunner.createIndex(
      'bookmarks',
      new TableIndex({
        name: 'idx_bookmark_post',
        columnNames: ['post_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.dropIndex('bookmarks', 'idx_bookmark_post');
    await queryRunner.dropIndex('bookmarks', 'idx_bookmark_user_created');

    // 테이블 삭제
    await queryRunner.dropTable('bookmarks');
  }
}