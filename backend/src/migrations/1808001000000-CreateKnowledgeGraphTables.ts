import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateKnowledgeGraphTables1808001000000
  implements MigrationInterface
{
  name = "CreateKnowledgeGraphTables1808001000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "knowledge_sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "postId" uuid NOT NULL,
        "postVersion" integer NOT NULL DEFAULT 1,
        "contentHash" character varying(128) NOT NULL,
        "normalizedPayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "outboundUrls" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "compiledAt" TIMESTAMP,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_sources_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_sources_user_post" ON "knowledge_sources" ("userId", "postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_sources_user_status" ON "knowledge_sources" ("userId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "parentNodeId" uuid,
        "slug" character varying(140) NOT NULL,
        "title" character varying(200) NOT NULL,
        "nodeType" character varying(20) NOT NULL,
        "canonicalPath" character varying(500) NOT NULL,
        "summary" text,
        "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "postCount" integer NOT NULL DEFAULT 0,
        "evidenceCount" integer NOT NULL DEFAULT 0,
        "lastCompiledAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_nodes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_nodes_user_slug" ON "knowledge_nodes" ("userId", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_nodes_user_parent" ON "knowledge_nodes" ("userId", "parentNodeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_nodes_user_status" ON "knowledge_nodes" ("userId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_edges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sourceId" uuid NOT NULL,
        "fromNodeId" uuid NOT NULL,
        "toNodeId" uuid NOT NULL,
        "relationType" character varying(30) NOT NULL,
        "confidence" numeric(5,4),
        "reason" text,
        "evidenceCount" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_edges_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_edges_user_source" ON "knowledge_edges" ("userId", "sourceId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_knowledge_edges_unique_source_relation" ON "knowledge_edges" ("userId", "sourceId", "fromNodeId", "toNodeId", "relationType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_edges_user_from" ON "knowledge_edges" ("userId", "fromNodeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_edges_user_to" ON "knowledge_edges" ("userId", "toNodeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "post_knowledge_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "postId" uuid NOT NULL,
        "nodeId" uuid NOT NULL,
        "sourceId" uuid,
        "role" character varying(20) NOT NULL,
        "confidence" numeric(5,4),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_knowledge_links_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_post_knowledge_links_post_node" ON "post_knowledge_links" ("postId", "nodeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_knowledge_links_user_post" ON "post_knowledge_links" ("userId", "postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_knowledge_links_user_node" ON "post_knowledge_links" ("userId", "nodeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_followup_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "postId" uuid,
        "nodeId" uuid,
        "title" character varying(240) NOT NULL,
        "reason" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "dismissedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_followup_suggestions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_followups_user_status" ON "knowledge_followup_suggestions" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_followups_user_post" ON "knowledge_followup_suggestions" ("userId", "postId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_compile_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "blogId" uuid,
        "postId" uuid NOT NULL,
        "postVersion" integer NOT NULL DEFAULT 1,
        "contentHash" character varying(128) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'queued',
        "mode" character varying(20) NOT NULL DEFAULT 'heuristic',
        "error" text,
        "resultSummary" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_compile_runs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_compile_runs_user_post_hash" ON "knowledge_compile_runs" ("userId", "postId", "contentHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_compile_runs_user_status" ON "knowledge_compile_runs" ("userId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "knowledge_manifest_cache" (
        "userId" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_manifest_cache_user" PRIMARY KEY ("userId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_manifest_cache"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_compile_runs_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_compile_runs_user_post_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_compile_runs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_followups_user_post"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_followups_user_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_followup_suggestions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_knowledge_links_user_node"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_knowledge_links_user_post"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_knowledge_links_post_node"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_knowledge_links"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_edges_user_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_edges_user_from"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_edges_unique_source_relation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_edges_user_source"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_edges"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_nodes_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_nodes_user_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_nodes_user_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_nodes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_sources_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_sources_user_post"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_sources"`);
  }
}
