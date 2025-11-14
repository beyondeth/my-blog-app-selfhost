import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDeletedUserBlogSlugs1763800000000 implements MigrationInterface {
  name = 'FixDeletedUserBlogSlugs1763800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 삭제된 사용자들의 블로그 slug를 'deleted-{original-slug}-{user-id-timestamp}' 형식으로 변경
    await queryRunner.query(`
      UPDATE blogs b
      SET slug = 'deleted-' || b.slug || '-' || EXTRACT(EPOCH FROM u."updatedAt")::bigint
      FROM users u
      WHERE b."userId" = u.id
        AND u."isDeleted" = true
        AND b.slug NOT LIKE 'deleted-%'
    `);

    // 변경된 블로그 수 로깅
    const result = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM blogs b
      WHERE b.slug LIKE 'deleted-%'
    `);

    console.log(`[Migration] Updated ${result[0].count} deleted user blog slugs`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백은 복잡하므로 수동 처리 필요
    console.warn('[Migration] Rollback requires manual intervention');
  }
}