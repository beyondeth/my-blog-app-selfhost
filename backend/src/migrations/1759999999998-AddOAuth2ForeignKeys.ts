import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * OAuth2 테이블에 외래 키 제약 조건 추가
 * InitialSchema 이후에 실행되어야 함
 */
export class AddOAuth2ForeignKeys1759999999998 implements MigrationInterface {
    name = 'AddOAuth2ForeignKeys1759999999998';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // users 테이블에 대한 외래 키 (존재하지 않을 경우만 추가)
        const hasOAuthClientsUserFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'oauth_clients'
            AND constraint_name = 'FK_oauth_clients_userId'
        `);

        if (hasOAuthClientsUserFK.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "oauth_clients"
                ADD CONSTRAINT "FK_oauth_clients_userId"
                FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        const hasOAuthCodesUserFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'oauth_codes'
            AND constraint_name = 'FK_oauth_codes_userId'
        `);

        if (hasOAuthCodesUserFK.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "oauth_codes"
                ADD CONSTRAINT "FK_oauth_codes_userId"
                FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        const hasOAuthTokensUserFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'oauth_tokens'
            AND constraint_name = 'FK_oauth_tokens_userId'
        `);

        if (hasOAuthTokensUserFK.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "oauth_tokens"
                ADD CONSTRAINT "FK_oauth_tokens_userId"
                FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        // blogs 테이블에 대한 외래 키 (존재하지 않을 경우만 추가)
        const hasOAuthCodesBlogFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'oauth_codes'
            AND constraint_name = 'FK_oauth_codes_blogId'
        `);

        if (hasOAuthCodesBlogFK.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "oauth_codes"
                ADD CONSTRAINT "FK_oauth_codes_blogId"
                FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }

        const hasOAuthTokensBlogFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'oauth_tokens'
            AND constraint_name = 'FK_oauth_tokens_blogId'
        `);

        if (hasOAuthTokensBlogFK.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "oauth_tokens"
                ADD CONSTRAINT "FK_oauth_tokens_blogId"
                FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 외래 키 제약 조건 삭제
        await queryRunner.query(`ALTER TABLE "oauth_tokens" DROP CONSTRAINT IF EXISTS "FK_oauth_tokens_blogId"`);
        await queryRunner.query(`ALTER TABLE "oauth_codes" DROP CONSTRAINT IF EXISTS "FK_oauth_codes_blogId"`);
        await queryRunner.query(`ALTER TABLE "oauth_tokens" DROP CONSTRAINT IF EXISTS "FK_oauth_tokens_userId"`);
        await queryRunner.query(`ALTER TABLE "oauth_codes" DROP CONSTRAINT IF EXISTS "FK_oauth_codes_userId"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT IF EXISTS "FK_oauth_clients_userId"`);
    }
}
