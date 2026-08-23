import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Introduce the tenant boundary without changing the existing self-hosted
 * product model. Existing users receive one personal organization and all
 * user-owned resources are linked to it.
 */
export class CreateOrganizationsAndTenantLinks1804300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "slug" character varying(160) NOT NULL,
        "ownerId" uuid NOT NULL,
        "isPersonal" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_organizations_owner" FOREIGN KEY ("ownerId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" character varying(20) NOT NULL DEFAULT 'member',
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_members_scope" UNIQUE ("organizationId", "userId"),
        CONSTRAINT "FK_organization_members_organization" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_members_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "files"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "mcp_api_keys"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `);

    // One deterministic personal tenant per existing user.
    await queryRunner.query(`
      INSERT INTO "organizations" ("name", "slug", "ownerId", "isPersonal")
      SELECT
        LEFT(COALESCE(NULLIF(u."username", ''), split_part(u."email", '@', 1), 'Personal Workspace'), 150),
        'personal-' || replace(u."id"::text, '-', ''),
        u."id",
        true
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "organizations" o WHERE o."ownerId" = u."id" AND o."isPersonal" = true
      )
    `);

    await queryRunner.query(`
      INSERT INTO "organization_members" ("organizationId", "userId", "role", "status")
      SELECT o."id", o."ownerId", 'owner', 'active'
      FROM "organizations" o
      WHERE o."isPersonal" = true
        AND NOT EXISTS (
          SELECT 1 FROM "organization_members" m
          WHERE m."organizationId" = o."id" AND m."userId" = o."ownerId"
        )
    `);

    await queryRunner.query(`
      UPDATE "blogs" b
      SET "organizationId" = o."id"
      FROM "organizations" o
      WHERE b."userId" = o."ownerId" AND o."isPersonal" = true
        AND b."organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "files" f
      SET "organizationId" = o."id"
      FROM "organizations" o
      WHERE f."user_id" = o."ownerId" AND o."isPersonal" = true
        AND f."organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "mcp_api_keys" k
      SET "organizationId" = b."organizationId"
      FROM "blogs" b
      WHERE k."blogId" = b."id" AND k."organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "audit_logs" a
      SET "organizationId" = o."id"
      FROM "organizations" o
      WHERE a."performedById" = o."ownerId" AND a."organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "communities" c
      SET "organizationId" = o."id"
      FROM "organizations" o
      WHERE c."creatorId" = o."ownerId" AND c."organizationId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
      ADD CONSTRAINT "FK_blogs_organization" FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "files"
      ADD CONSTRAINT "FK_files_organization" FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "mcp_api_keys"
      ADD CONSTRAINT "FK_mcp_api_keys_organization" FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "FK_audit_logs_organization" FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD CONSTRAINT "FK_communities_organization" FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_ownerId" ON "organizations" ("ownerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organization_members_userId_status" ON "organization_members" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blogs_organizationId" ON "blogs" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_files_organizationId" ON "files" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_api_keys_organizationId" ON "mcp_api_keys" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_organizationId" ON "audit_logs" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_communities_organizationId" ON "communities" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" DROP CONSTRAINT IF EXISTS "FK_communities_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "FK_audit_logs_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_api_keys" DROP CONSTRAINT IF EXISTS "FK_mcp_api_keys_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "FK_files_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blogs" DROP CONSTRAINT IF EXISTS "FK_blogs_organization"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_communities_organizationId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_organizationId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mcp_api_keys_organizationId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_files_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blogs_organizationId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_organization_members_userId_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_ownerId"`);

    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_api_keys" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blogs" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
  }
}
