import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOAuth2Tables1734930000000 implements MigrationInterface {
    name = 'AddOAuth2Tables1734930000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // OAuth Clients 테이블 생성
        await queryRunner.query(`
            CREATE TABLE "oauth_clients" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "clientId" character varying NOT NULL,
                "clientSecret" character varying NOT NULL,
                "clientName" character varying NOT NULL,
                "redirectUris" text NOT NULL,
                "allowedScopes" text NOT NULL DEFAULT 'mcp:post:create',
                "grantTypes" character varying NOT NULL DEFAULT 'authorization_code',
                "userId" uuid NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "isTrusted" boolean NOT NULL DEFAULT false,
                "description" text,
                "lastUsedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_oauth_clients_clientId" UNIQUE ("clientId"),
                CONSTRAINT "PK_oauth_clients" PRIMARY KEY ("id")
            )
        `);

        // OAuth Codes 테이블 생성
        await queryRunner.query(`
            CREATE TABLE "oauth_codes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying NOT NULL,
                "userId" uuid NOT NULL,
                "blogId" uuid NOT NULL,
                "clientId" uuid NOT NULL,
                "redirectUri" character varying NOT NULL,
                "scopes" text NOT NULL,
                "codeChallenge" character varying,
                "codeChallengeMethod" character varying,
                "expiresAt" TIMESTAMP NOT NULL,
                "isUsed" boolean NOT NULL DEFAULT false,
                "usedAt" TIMESTAMP,
                "issuedIp" character varying,
                "state" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_oauth_codes_code" UNIQUE ("code"),
                CONSTRAINT "PK_oauth_codes" PRIMARY KEY ("id")
            )
        `);

        // OAuth Tokens 테이블 생성
        await queryRunner.query(`
            CREATE TABLE "oauth_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tokenHash" character varying NOT NULL,
                "refreshTokenHash" character varying,
                "tokenType" character varying NOT NULL DEFAULT 'access',
                "userId" uuid NOT NULL,
                "blogId" uuid NOT NULL,
                "clientId" uuid NOT NULL,
                "scopes" text NOT NULL,
                "expiresAt" TIMESTAMP NOT NULL,
                "isRevoked" boolean NOT NULL DEFAULT false,
                "revokedAt" TIMESTAMP,
                "revokeReason" character varying,
                "lastUsedAt" TIMESTAMP,
                "issuedIp" character varying,
                "issuedUserAgent" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_oauth_tokens_tokenHash" UNIQUE ("tokenHash"),
                CONSTRAINT "PK_oauth_tokens" PRIMARY KEY ("id")
            )
        `);

        // 인덱스 생성
        await queryRunner.query(`CREATE INDEX "IDX_oauth_clients_clientId" ON "oauth_clients" ("clientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_oauth_clients_userId" ON "oauth_clients" ("userId")`);

        await queryRunner.query(`CREATE INDEX "IDX_oauth_codes_code" ON "oauth_codes" ("code")`);
        await queryRunner.query(`CREATE INDEX "IDX_oauth_codes_expiresAt" ON "oauth_codes" ("expiresAt")`);

        await queryRunner.query(`CREATE INDEX "IDX_oauth_tokens_tokenHash" ON "oauth_tokens" ("tokenHash")`);
        await queryRunner.query(`CREATE INDEX "IDX_oauth_tokens_userId" ON "oauth_tokens" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_oauth_tokens_blogId" ON "oauth_tokens" ("blogId")`);
        await queryRunner.query(`CREATE INDEX "IDX_oauth_tokens_expiresAt" ON "oauth_tokens" ("expiresAt")`);

        // 외래 키 제약 조건 추가는 AddOAuth2ForeignKeys migration에서 처리
        // (Migration 순서 문제 해결을 위해 별도 migration으로 분리)

        // oauth_clients 내부 FK는 추가 가능
        await queryRunner.query(`
            ALTER TABLE "oauth_codes"
            ADD CONSTRAINT "FK_oauth_codes_clientId"
            FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "oauth_tokens"
            ADD CONSTRAINT "FK_oauth_tokens_clientId"
            FOREIGN KEY ("clientId") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 외래 키 제약 조건 삭제 (이 migration에서 추가한 것만)
        await queryRunner.query(`ALTER TABLE "oauth_tokens" DROP CONSTRAINT IF EXISTS "FK_oauth_tokens_clientId"`);
        await queryRunner.query(`ALTER TABLE "oauth_codes" DROP CONSTRAINT IF EXISTS "FK_oauth_codes_clientId"`);

        // 인덱스 삭제
        await queryRunner.query(`DROP INDEX "IDX_oauth_tokens_expiresAt"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_tokens_blogId"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_tokens_tokenHash"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_codes_expiresAt"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_codes_code"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_clients_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_oauth_clients_clientId"`);

        // 테이블 삭제
        await queryRunner.query(`DROP TABLE "oauth_tokens"`);
        await queryRunner.query(`DROP TABLE "oauth_codes"`);
        await queryRunner.query(`DROP TABLE "oauth_clients"`);
    }
}