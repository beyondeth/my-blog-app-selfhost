import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillPostMetadataShadowFields1805401000000
  implements MigrationInterface
{
  name = "BackfillPostMetadataShadowFields1805401000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "post_metadata" (
        "id",
        "postId",
        "excerpt",
        "tags",
        "category",
        "content_type",
        "publishedAt",
        "processingError",
        "processingCompletedAt",
        "indexedAt",
        "searchVector",
        "wordCount",
        "readingTimeMinutes",
        "editCount",
        "createdAt",
        "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        p.id,
        p.excerpt,
        COALESCE(p.tags, '[]'::jsonb),
        COALESCE(p.category, '기타'),
        COALESCE(p.content_type, 'html'),
        p."publishedAt",
        p.processing_error,
        p.processing_completed_at,
        p.indexed_at,
        p.search_vector,
        0,
        0,
        0,
        p."createdAt",
        p."updatedAt"
      FROM "posts" p
      LEFT JOIN "post_metadata" pm ON pm."postId" = p.id
      WHERE pm.id IS NULL
        AND p."isDeleted" = false
    `);

    await queryRunner.query(`
      UPDATE "post_metadata" pm
      SET
        "excerpt" = p.excerpt,
        "tags" = COALESCE(p.tags, '[]'::jsonb),
        "category" = COALESCE(p.category, '기타'),
        "content_type" = COALESCE(p.content_type, 'html'),
        "publishedAt" = p."publishedAt",
        "processingError" = p.processing_error,
        "processingCompletedAt" = p.processing_completed_at,
        "indexedAt" = p.indexed_at,
        "searchVector" = p.search_vector,
        "updatedAt" = NOW()
      FROM "posts" p
      WHERE pm."postId" = p.id
        AND p."isDeleted" = false
        AND (
          COALESCE(pm."excerpt", '') IS DISTINCT FROM COALESCE(p.excerpt, '')
          OR COALESCE(pm."tags"::text, '[]') IS DISTINCT FROM COALESCE(p.tags::text, '[]')
          OR COALESCE(pm."category", '') IS DISTINCT FROM COALESCE(p.category, '')
          OR COALESCE(pm."content_type", '') IS DISTINCT FROM COALESCE(p.content_type, '')
          OR COALESCE(pm."processingError", '') IS DISTINCT FROM COALESCE(p.processing_error, '')
          OR COALESCE(
            to_char(pm."processingCompletedAt", 'YYYY-MM-DD HH24:MI:SS'),
            ''
          ) IS DISTINCT FROM COALESCE(
            to_char(p.processing_completed_at, 'YYYY-MM-DD HH24:MI:SS'),
            ''
          )
          OR COALESCE(
            to_char(pm."publishedAt", 'YYYY-MM-DD HH24:MI:SS'),
            ''
          ) IS DISTINCT FROM COALESCE(
            to_char(p."publishedAt", 'YYYY-MM-DD HH24:MI:SS'),
            ''
          )
          OR COALESCE(
            to_char(pm."indexedAt", 'YYYY-MM-DD HH24:MI:SS'),
            ''
          ) IS DISTINCT FROM COALESCE(
            to_char(p.indexed_at, 'YYYY-MM-DD HH24:MI:SS'),
            ''
          )
          OR COALESCE(pm."searchVector"::text, '') IS DISTINCT FROM COALESCE(p.search_vector::text, '')
        )
    `);
  }

  public async down(): Promise<void> {
    // Intentionally no-op.
    // This migration backfills shadow fields from the canonical posts table and
    // should not delete production metadata on rollback.
  }
}
