import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatEntities1758108745064 implements MigrationInterface {
    name = 'AddChatEntities1758108745064'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" DROP CONSTRAINT "FK_mcp_user_logs_api_key_id"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" DROP CONSTRAINT "FK_mcp_user_logs_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_popularity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_date_popularity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_view_update"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_posts_tagList"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_suspicious_requests_type_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_suspicious_requests_ip_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_suspicious_requests_severity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_suspicious_requests_resolved"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" DROP CONSTRAINT "mcp_user_logs_action_type_check"`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "senderId" uuid NOT NULL, "content" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP WITH TIME ZONE, "isEdited" boolean NOT NULL DEFAULT false, "editedAt" TIMESTAMP WITH TIME ZONE, "isDeleted" boolean NOT NULL DEFAULT false, "deletedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae3339e4dc812b1f37ce63fd52" ON "messages" ("conversationId", "isRead") `);
        await queryRunner.query(`CREATE INDEX "IDX_751332fc6cc6fc576c6975cd07" ON "messages" ("conversationId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user1Id" uuid NOT NULL, "user2Id" uuid NOT NULL, "lastMessageAt" TIMESTAMP WITH TIME ZONE, "user1DeletedAt" TIMESTAMP WITH TIME ZONE, "user2DeletedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b853c3320df7cf06b7bfa413c8" ON "conversations" ("lastMessageAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0a0db99cefe97147bef6bd89a0" ON "conversations" ("user1Id", "user2Id") `);
        await queryRunner.query(`CREATE TABLE "user_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blockerId" uuid NOT NULL, "blockedId" uuid NOT NULL, "reason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0bae5f5cab7574a84889462187c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18d34df8212648b698828f244f" ON "user_blocks" ("blockedId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eae09d4f95afa5ae30c2838460" ON "user_blocks" ("blockerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fc74151c76df192714f76b2a2e" ON "user_blocks" ("blockerId", "blockedId") `);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "tags"`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "tagList" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "suspicious_requests" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_user_time"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_client"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_action"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_api_key"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ALTER COLUMN "timestamp" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_e923d6495a742d81c8e9fe6cb9" ON "suspicious_requests" ("ipAddress", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_eb3149031983377c4d384acb0c" ON "suspicious_requests" ("requestType", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_api_key" ON "mcp_user_logs" ("api_key_id", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_action" ON "mcp_user_logs" ("action_type", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_client" ON "mcp_user_logs" ("client_type", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_user_time" ON "mcp_user_logs" ("user_id", "timestamp") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b3aa10c29ea4e61a830362bd25" ON "tags" ("slug") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d90243459a697eadb8ad56e909" ON "tags" ("name") `);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ADD CONSTRAINT "FK_624de2fd75948ae18aa323fe57c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ADD CONSTRAINT "FK_ec661c40cdd866cfde4aceafe6f" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_47c90625a3eed92def079e1a78d" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_eae09d4f95afa5ae30c28384607" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_18d34df8212648b698828f244fb" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_18d34df8212648b698828f244fb"`);
        await queryRunner.query(`ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_eae09d4f95afa5ae30c28384607"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_47c90625a3eed92def079e1a78d"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" DROP CONSTRAINT "FK_ec661c40cdd866cfde4aceafe6f"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" DROP CONSTRAINT "FK_624de2fd75948ae18aa323fe57c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d90243459a697eadb8ad56e909"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3aa10c29ea4e61a830362bd25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_user_time"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_client"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_action"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mcp_logs_api_key"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb3149031983377c4d384acb0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e923d6495a742d81c8e9fe6cb9"`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_api_key" ON "mcp_user_logs" ("api_key_id", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_action" ON "mcp_user_logs" ("action_type", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_client" ON "mcp_user_logs" ("client_type", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_mcp_logs_user_time" ON "mcp_user_logs" ("timestamp", "user_id") `);
        await queryRunner.query(`ALTER TABLE "suspicious_requests" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "tagList" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "tags" text`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc74151c76df192714f76b2a2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eae09d4f95afa5ae30c2838460"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18d34df8212648b698828f244f"`);
        await queryRunner.query(`DROP TABLE "user_blocks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a0db99cefe97147bef6bd89a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b853c3320df7cf06b7bfa413c8"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_751332fc6cc6fc576c6975cd07"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae3339e4dc812b1f37ce63fd52"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ADD CONSTRAINT "mcp_user_logs_action_type_check" CHECK (((action_type)::text = ANY ((ARRAY['read'::character varying, 'write'::character varying, 'search'::character varying])::text[])))`);
        await queryRunner.query(`CREATE INDEX "IDX_suspicious_requests_resolved" ON "suspicious_requests" ("isResolved") `);
        await queryRunner.query(`CREATE INDEX "IDX_suspicious_requests_severity" ON "suspicious_requests" ("severity") `);
        await queryRunner.query(`CREATE INDEX "IDX_suspicious_requests_ip_date" ON "suspicious_requests" ("createdAt", "ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_suspicious_requests_type_date" ON "suspicious_requests" ("createdAt", "requestType") `);
        await queryRunner.query(`CREATE INDEX "IDX_posts_tagList" ON "posts" ("tagList") `);
        await queryRunner.query(`CREATE INDEX "IDX_post_view_update" ON "posts" ("id", "viewCount") `);
        await queryRunner.query(`CREATE INDEX "IDX_post_date_popularity" ON "posts" ("commentCount", "likeCount", "publishedAt", "viewCount") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "IDX_post_popularity" ON "posts" ("commentCount", "isPublished", "likeCount", "viewCount") WHERE ("isPublished" = true)`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ADD CONSTRAINT "FK_mcp_user_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mcp_user_logs" ADD CONSTRAINT "FK_mcp_user_logs_api_key_id" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
