import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKnowledgeCandidateArtifacts1808101000000
  implements MigrationInterface
{
  name = "AddKnowledgeCandidateArtifacts1808101000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "knowledge_source_artifacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "postId" uuid NOT NULL,
        "sourceId" uuid,
        "contentHash" character varying(128) NOT NULL,
        "artifact" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "draftPayload" jsonb,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_source_artifacts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_source_artifacts_user_post" ON "knowledge_source_artifacts" ("userId", "postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_source_artifacts_user_status" ON "knowledge_source_artifacts" ("userId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_candidate_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "slug" character varying(160) NOT NULL,
        "title" character varying(200) NOT NULL,
        "nodeType" character varying(20) NOT NULL,
        "proposedParentSlug" character varying(160),
        "summary" text,
        "status" character varying(20) NOT NULL DEFAULT 'provisional',
        "canonicalNodeId" uuid,
        "sourceCount" integer NOT NULL DEFAULT 0,
        "postCount" integer NOT NULL DEFAULT 0,
        "avgConfidence" numeric(5,4),
        "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_candidate_nodes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_candidate_nodes_user_slug" ON "knowledge_candidate_nodes" ("userId", "blogId", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_candidate_nodes_user_status" ON "knowledge_candidate_nodes" ("userId", "blogId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_candidate_nodes_user_canonical" ON "knowledge_candidate_nodes" ("userId", "blogId", "canonicalNodeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_candidate_edges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "fromSlug" character varying(160) NOT NULL,
        "toSlug" character varying(160) NOT NULL,
        "relationType" character varying(30) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'provisional',
        "sourceCount" integer NOT NULL DEFAULT 0,
        "postCount" integer NOT NULL DEFAULT 0,
        "avgConfidence" numeric(5,4),
        "reason" text,
        "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_candidate_edges_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_candidate_edges_user_unique" ON "knowledge_candidate_edges" ("userId", "blogId", "fromSlug", "toSlug", "relationType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_candidate_edges_user_status" ON "knowledge_candidate_edges" ("userId", "blogId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_aliases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "aliasSlug" character varying(160) NOT NULL,
        "label" character varying(200) NOT NULL,
        "targetNodeId" uuid,
        "candidateNodeId" uuid,
        "sourceType" character varying(20) NOT NULL DEFAULT 'artifact',
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_aliases_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_aliases_user_alias" ON "knowledge_aliases" ("userId", "blogId", "aliasSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_aliases_user_status" ON "knowledge_aliases" ("userId", "blogId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_aliases_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_aliases_user_alias"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_aliases"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_candidate_edges_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_candidate_edges_user_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_candidate_edges"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_candidate_nodes_user_canonical"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_candidate_nodes_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_candidate_nodes_user_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_candidate_nodes"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_source_artifacts_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_source_artifacts_user_post"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_source_artifacts"`);
  }
}
