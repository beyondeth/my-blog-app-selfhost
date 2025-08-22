import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminDashboardEntities1755600000000 implements MigrationInterface {
  name = 'AddAdminDashboardEntities1755600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if enums already exist before creating
    const reportTypeExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'reports_type_enum'
    `);
    
    if (reportTypeExists.length === 0) {
      // Create report enums
      await queryRunner.query(`
        CREATE TYPE "public"."reports_type_enum" AS ENUM('post', 'comment', 'user')
      `);
    }
    
    await queryRunner.query(`
      CREATE TYPE "public"."reports_reason_enum" AS ENUM(
        'spam', 'hate_speech', 'inappropriate_content', 
        'harassment', 'copyright_violation', 'misinformation', 'other'
      )
    `);
    
    await queryRunner.query(`
      CREATE TYPE "public"."reports_status_enum" AS ENUM(
        'pending', 'under_review', 'resolved', 'dismissed', 'escalated'
      )
    `);
    
    await queryRunner.query(`
      CREATE TYPE "public"."reports_actiontaken_enum" AS ENUM(
        'no_action', 'warning_issued', 'content_removed', 
        'user_suspended', 'user_banned'
      )
    `);

    // Create reports table
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."reports_type_enum" NOT NULL,
        "reason" "public"."reports_reason_enum" NOT NULL,
        "description" text,
        "targetId" uuid NOT NULL,
        "reportedById" uuid NOT NULL,
        "status" "public"."reports_status_enum" NOT NULL DEFAULT 'pending',
        "actionTaken" "public"."reports_actiontaken_enum",
        "moderatorNotes" text,
        "reviewedById" uuid,
        "reviewedAt" TIMESTAMP,
        "priority" integer NOT NULL DEFAULT '1',
        "metadata" jsonb,
        "ipAddress" character varying,
        "userAgent" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for reports
    await queryRunner.query(`CREATE INDEX "IDX_reports_type_targetId" ON "reports" ("type", "targetId")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_status" ON "reports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_reportedById" ON "reports" ("reportedById")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_createdAt" ON "reports" ("createdAt")`);

    // Create audit action enum
    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_action_enum" AS ENUM(
        'user_created', 'user_updated', 'user_deleted', 'user_suspended', 
        'user_banned', 'user_activated', 'user_role_changed',
        'post_created', 'post_updated', 'post_deleted', 
        'post_published', 'post_unpublished',
        'comment_created', 'comment_updated', 'comment_deleted',
        'report_created', 'report_reviewed', 'report_resolved', 
        'report_dismissed', 'report_escalated',
        'admin_login', 'admin_logout', 'admin_access_denied', 
        'settings_updated', 'bulk_action_performed'
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" "public"."audit_logs_action_enum" NOT NULL,
        "entityType" character varying(50) NOT NULL,
        "entityId" uuid,
        "previousData" jsonb,
        "newData" jsonb,
        "metadata" jsonb,
        "performedById" uuid NOT NULL,
        "ipAddress" character varying,
        "userAgent" character varying,
        "sessionId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for audit_logs
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityType_entityId" ON "audit_logs" ("entityType", "entityId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_performedById" ON "audit_logs" ("performedById")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);

    // Add foreign key constraints for reports
    await queryRunner.query(`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "FK_reports_reportedBy" 
      FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "FK_reports_reviewedBy" 
      FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for audit_logs
    await queryRunner.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "FK_audit_logs_performedBy" 
      FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_performedBy"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_reviewedBy"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_reportedBy"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_performedById"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_entityType_entityId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_reportedById"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_type_targetId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "reports"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_actiontaken_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_reason_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_type_enum"`);
  }
}