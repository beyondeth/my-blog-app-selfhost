import { MigrationInterface, QueryRunner } from "typeorm";
import { v7 as uuidv7 } from 'uuid';

export class FixExistingPostSlugs1761203000000 implements MigrationInterface {
    name = 'FixExistingPostSlugs1761203000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 기존 포스트들 중에서 date-timestamp 형식의 slug를 가진 포스트들 찾아서
        // UUID v7 형식으로 변경
        // 예: 2025-11-12-12-758364 -> title-base-uuidv7

        const posts = await queryRunner.query(`
            SELECT id, title, slug
            FROM posts
            WHERE slug ~ '^\d{4}-\d{2}-\d{2}-\d{2}-\d+$'
            AND slug IS NOT NULL
        `);

        for (const post of posts) {
            // title로 기본 slug 생성
            const baseSlug = post.title
                .toLowerCase()
                .replace(/[^a-z0-9가-힣]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 50);

            // UUID v7 생성
            const uniqueId = uuidv7().split('-')[0];
            const newSlug = `${baseSlug}-${uniqueId}`;

            // slug 업데이트
            await queryRunner.query(`
                UPDATE posts
                SET slug = $1
                WHERE id = $2
            `, [newSlug, post.id]);

            console.log(`Updated slug for post ${post.id}: ${post.slug} -> ${newSlug}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 마이그레이션 롤백 시 원복할 수 없으므로 빈 메서드 유지
        // slug는 다시 생성할 수 있음
    }
}