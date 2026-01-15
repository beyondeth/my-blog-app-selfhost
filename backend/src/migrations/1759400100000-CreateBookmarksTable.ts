import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateBookmarksTable1759400100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // bookmarks 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: "bookmarks",
        columns: [
          {
            name: "userId",
            type: "uuid",
            isPrimary: true,
          },
          {
            name: "postId",
            type: "uuid",
            isPrimary: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
          },
        ],
        foreignKeys: [
          {
            name: "FK_bookmark_user",
            columnNames: ["userId"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
          {
            name: "FK_bookmark_post",
            columnNames: ["postId"],
            referencedTableName: "posts",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
        ],
      }),
      true,
    );

    // 인덱스 생성 - 사용자별 최신순 조회 최적화
    await queryRunner.createIndex(
      "bookmarks",
      new TableIndex({
        name: "idx_bookmark_user_created",
        columnNames: ["userId", "createdAt"],
      }),
    );

    // 인덱스 생성 - 포스트별 북마크 조회 최적화
    await queryRunner.createIndex(
      "bookmarks",
      new TableIndex({
        name: "idx_bookmark_post",
        columnNames: ["postId"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.dropIndex("bookmarks", "idx_bookmark_post");
    await queryRunner.dropIndex("bookmarks", "idx_bookmark_user_created");

    // 테이블 삭제
    await queryRunner.dropTable("bookmarks");
  }
}
