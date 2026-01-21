import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 평판 시스템 테이블 생성 마이그레이션
 *
 * 생성되는 테이블:
 * 1. reputation_ledger - 평판 점수 변동 원장
 * 2. reputation_total - 사용자별 기간별 총점
 * 3. title_grant - 타이틀 부여 이력
 */
export class CreateReputationTables1793000000000 implements MigrationInterface {
  name = "CreateReputationTables1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. reputation_ledger 테이블 생성
    // 모든 평판 점수 변동 내역을 기록하는 불변 원장
    await queryRunner.query(`
      CREATE TABLE "reputation_ledger" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "action_type" character varying(50) NOT NULL,
        "target_type" character varying(50),
        "target_id" uuid,
        "delta" integer NOT NULL,
        "reaction_count" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "recorded_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reputation_ledger" PRIMARY KEY ("id")
      )
    `);

    // reputation_ledger 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_reputation_ledger_user_recorded" 
      ON "reputation_ledger" ("user_id", "recorded_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_reputation_ledger_action_recorded" 
      ON "reputation_ledger" ("action_type", "recorded_at")
    `);

    // reputation_ledger 외래 키
    await queryRunner.query(`
      ALTER TABLE "reputation_ledger" 
      ADD CONSTRAINT "FK_reputation_ledger_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // 2. reputation_total 테이블 생성
    // 사용자별 기간별 집계된 총점
    await queryRunner.query(`
      CREATE TABLE "reputation_total" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "period" character varying(20) NOT NULL,
        "score" numeric(12,2) NOT NULL DEFAULT 0,
        "decayed_score" numeric(12,2) NOT NULL DEFAULT 0,
        "last_computed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reputation_total" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reputation_total_user_period" UNIQUE ("user_id", "period")
      )
    `);

    // reputation_total 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_reputation_total_period_score" 
      ON "reputation_total" ("period", "decayed_score" DESC)
    `);

    // reputation_total 외래 키
    await queryRunner.query(`
      ALTER TABLE "reputation_total" 
      ADD CONSTRAINT "FK_reputation_total_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // 3. title_grant 테이블 생성
    // 사용자에게 부여된 타이틀 이력
    await queryRunner.query(`
      CREATE TABLE "title_grant" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title_code" character varying(50) NOT NULL,
        "granted_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP,
        "context" jsonb,
        CONSTRAINT "PK_title_grant" PRIMARY KEY ("id")
      )
    `);

    // title_grant 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_title_grant_code_expires" 
      ON "title_grant" ("title_code", "expires_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_title_grant_user_code_expires" 
      ON "title_grant" ("user_id", "title_code", "expires_at")
    `);

    // title_grant 외래 키
    await queryRunner.query(`
      ALTER TABLE "title_grant" 
      ADD CONSTRAINT "FK_title_grant_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 외래 키 제거
    await queryRunner.query(
      `ALTER TABLE "title_grant" DROP CONSTRAINT "FK_title_grant_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_total" DROP CONSTRAINT "FK_reputation_total_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reputation_ledger" DROP CONSTRAINT "FK_reputation_ledger_user"`,
    );

    // 인덱스 제거
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_title_grant_user_code_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_title_grant_code_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_reputation_total_period_score"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_reputation_ledger_action_recorded"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_reputation_ledger_user_recorded"`,
    );

    // 테이블 제거
    await queryRunner.query(`DROP TABLE IF EXISTS "title_grant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reputation_total"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reputation_ledger"`);
  }
}
