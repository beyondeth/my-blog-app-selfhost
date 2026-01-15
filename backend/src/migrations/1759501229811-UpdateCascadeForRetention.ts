import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCascadeForRetention1759501229811
  implements MigrationInterface
{
  name = "UpdateCascadeForRetention1759501229811";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_47c90625a3eed92def079e1a78d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`,
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
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_47c90625a3eed92def079e1a78d" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_47c90625a3eed92def079e1a78d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('failed', 'partially_refunded', 'pending', 'refunded', 'succeeded')`,
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
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_5ecde0e8532667bde83d87ed0b4" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_47c90625a3eed92def079e1a78d" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
