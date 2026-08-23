import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshSessions1804800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_sessions" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "jti" uuid NOT NULL,
        "familyId" uuid NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "replacedBySessionId" uuid,
        "lastUsedAt" TIMESTAMP,
        "userAgent" character varying(255),
        "deviceName" character varying(100),
        "ipAddress" inet,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_sessions_jti" UNIQUE ("jti"),
        CONSTRAINT "FK_refresh_sessions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_sessions_user_revoked" ON "refresh_sessions" ("userId", "revokedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_sessions_family" ON "refresh_sessions" ("familyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refresh_sessions_family"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refresh_sessions_user_revoked"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_sessions"`);
  }
}
