import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * IP 및 User Agent 추적 컬럼 추가
 * 
 * 보안 고려사항:
 * - select: false로 설정되어 기본 조회 시 제외됨
 * - Admin Only API로만 조회 가능
 * - 기존 데이터는 NULL (이후 작성된 글/댓글만 IP 저장)
 */
export class AddIpTrackingToPostsAndComments1794000000000 implements MigrationInterface {
    name = 'AddIpTrackingToPostsAndComments1794000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Posts 테이블에 IP 추적 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "user_agent" TEXT NULL
        `);

        // Comments 테이블에 IP 추적 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "comments" 
            ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "comments" 
            ADD COLUMN IF NOT EXISTS "user_agent" TEXT NULL
        `);

        // IP Blocklist 테이블 생성 (존재하지 않을 경우)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ip_block_list" (
                "ip_address" VARCHAR(45) NOT NULL PRIMARY KEY,
                "reason" TEXT NOT NULL,
                "blocked_by" UUID,
                "expires_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Moderation Logs 테이블 생성 (존재하지 않을 경우)
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE moderation_action_enum AS ENUM ('WARN', 'MUTE', 'KICK', 'BAN_ACCOUNT', 'BLOCK_IP');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "moderation_logs" (
                "id" UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
                "admin_id" UUID NOT NULL,
                "target_user_id" UUID,
                "target_ip" VARCHAR(45),
                "action" moderation_action_enum NOT NULL DEFAULT 'WARN',
                "duration_minutes" INTEGER,
                "reason" TEXT NOT NULL,
                "admin_memo" TEXT,
                "evidence_snapshot" JSONB,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // 인덱스 추가
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_moderation_logs_admin" ON "moderation_logs" ("admin_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_moderation_logs_target_user" ON "moderation_logs" ("target_user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_moderation_logs_target_ip" ON "moderation_logs" ("target_ip")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_moderation_logs_created" ON "moderation_logs" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ip_block_list_expires" ON "ip_block_list" ("expires_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: 컬럼 및 테이블 삭제
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "ip_address"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "user_agent"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN IF EXISTS "ip_address"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN IF EXISTS "user_agent"`);
        
        await queryRunner.query(`DROP TABLE IF EXISTS "moderation_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ip_block_list"`);
        await queryRunner.query(`DROP TYPE IF EXISTS moderation_action_enum`);
    }
}
