import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentHistoryFields1759087856008
  implements MigrationInterface
{
  name = "AddPaymentHistoryFields1759087856008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_history" ADD "provider" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ADD "providerId" character varying`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payment_history_status_enum" RENAME TO "payment_history_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_history_status_enum" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum" USING "status"::"text"::"public"."payment_history_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."payment_history_status_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('pending', 'succeeded', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum_old" USING "status"::"text"::"public"."payment_history_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_history_status_enum_old" RENAME TO "payment_history_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" DROP COLUMN "providerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" DROP COLUMN "provider"`,
    );
  }
}
