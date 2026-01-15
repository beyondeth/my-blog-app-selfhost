import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailApprovalFields1759505600055 implements MigrationInterface {
  name = "AddEmailApprovalFields1759505600055";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "email_approvals" ADD "subject" text`);
    await queryRunner.query(`ALTER TABLE "email_approvals" ADD "content" text`);
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ADD "rejectedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ADD "rejectionReason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "scheduledAt" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "template" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "template" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ALTER COLUMN "scheduledAt" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" DROP COLUMN "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" DROP COLUMN "rejectedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" DROP COLUMN "content"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" DROP COLUMN "subject"`,
    );
  }
}
