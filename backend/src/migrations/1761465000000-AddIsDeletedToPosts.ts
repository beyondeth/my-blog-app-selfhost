import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Posts 테이블에 isDeleted 컬럼 추가
 *
 * 목적: 법적 요구사항 대응을 위한 Soft Delete 구현
 * - 사용자가 삭제될 때 포스트도 soft delete
 * - 법적 조회 시 삭제된 포스트 데이터 제공 가능
 * - 180일 보관 정책 준수
 *
 * 변경사항:
 * 1. isDeleted 컬럼 추가 (BOOLEAN, DEFAULT false)
 * 2. isDeleted + authorId 복합 인덱스 추가 (조회 성능 최적화)
 */
export class AddIsDeletedToPosts1761465000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. isDeleted 컬럼 추가
    await queryRunner.addColumn(
      'posts',
      new TableColumn({
        name: 'isDeleted',
        type: 'boolean',
        default: false,
        isNullable: false,
        comment: '소프트 삭제 플래그: 법적 조회용 데이터 보존',
      })
    );

    // 2. 기존 데이터에 기본값 적용 (이미 default로 처리됨)
    await queryRunner.query(`
      UPDATE posts SET "isDeleted" = false WHERE "isDeleted" IS NULL
    `);

    // 3. isDeleted + authorId 복합 인덱스 추가 (삭제된 포스트 조회 최적화)
    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_isDeleted_authorId',
        columnNames: ['isDeleted', 'authorId'],
      })
    );

    // 4. isDeleted 단일 인덱스 추가 (전체 삭제 목록 조회)
    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_isDeleted',
        columnNames: ['isDeleted'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 먼저 제거
    await queryRunner.dropIndex('posts', 'IDX_posts_isDeleted');
    await queryRunner.dropIndex('posts', 'IDX_posts_isDeleted_authorId');

    // 컬럼 제거
    await queryRunner.dropColumn('posts', 'isDeleted');
  }
}
