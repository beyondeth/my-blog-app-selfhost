import { MigrationInterface, QueryRunner } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export class FixMalformedPostSlugs1763100000000 implements MigrationInterface {
  name = 'FixMalformedPostSlugs1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 포스트들 중 슬러그가 잘못된 포스트들 찾기 (UUID로만 시작되는 슬러그)
    const malformedPosts = await queryRunner.query(`
      SELECT id, title, slug
      FROM posts
      WHERE slug ~ '^-[a-f0-9]{8}$'
         OR slug ~ '^post-[a-f0-9]{8}$'
         OR slug IS NULL
    `);

    console.log(`Found ${malformedPosts.length} posts with malformed slugs`);

    for (const post of malformedPosts) {
      // 새로운 슬러그 생성
      const baseSlug = post.title
        ? post.title
            .trim()
            .toLowerCase()
            .replace(/[^a-zA-Z0-9가-힣\s]/g, '') // 특수문자 제거
            .replace(/\s+/g, '-') // 공백을 하이픈으로 변환
            .replace(/-+/g, '-') // 중복 하이픈 제거
            .replace(/^-|-$/g, '') // 시작/끝 하이픈 제거
            .substring(0, 50)
        : 'post';

      // UUID 생성
      const uniqueId = uuidv7().split('-')[0];
      let newSlug = baseSlug ? `${baseSlug}-${uniqueId}` : `post-${uniqueId}`;

      // 슬러그 중복 확인
      const existingPost = await queryRunner.query(
        `SELECT id FROM posts WHERE slug = $1 AND id != $2`,
        [newSlug, post.id]
      );

      if (existingPost.length > 0) {
        // 중복 시 타임스탬프 추가
        const timestamp = Date.now();
        newSlug = `${baseSlug}-${timestamp}`;
      }

      // 슬러그 업데이트
      await queryRunner.query(
        `UPDATE posts SET slug = $1 WHERE id = $2`,
        [newSlug, post.id]
      );

      console.log(`Updated slug for post "${post.title}": ${post.slug} -> ${newSlug}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 마이그레이션 롤백은 어렵기 때문에 건너뛰기
    console.log('Rollback not supported for this migration');
  }
}