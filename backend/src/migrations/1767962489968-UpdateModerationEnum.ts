import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateModerationEnum1767962489968 implements MigrationInterface {
  name = "UpdateModerationEnum1767962489968";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const typeExistsResult = await queryRunner.query(`
            SELECT 1
            FROM pg_type
            WHERE typname = 'moderation_action_enum'
        `);
    if (typeExistsResult.length === 0) {
      await queryRunner.query(`
                DO $$ BEGIN
                    CREATE TYPE moderation_action_enum AS ENUM (
                        'WARN',
                        'MUTE',
                        'KICK',
                        'BAN_ACCOUNT',
                        'BLOCK_IP'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
    }

    const checkValue = async (value: string) => {
      const result = await queryRunner.query(`
                SELECT 1 FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid 
                WHERE t.typname = 'moderation_action_enum' AND e.enumlabel = '${value}'
            `);
      return result.length > 0;
    };

    if (!(await checkValue("SUSPEND_USER"))) {
      await queryRunner.query(
        `ALTER TYPE "public"."moderation_action_enum" ADD VALUE 'SUSPEND_USER'`,
      );
    }
    if (!(await checkValue("UNBAN_USER"))) {
      await queryRunner.query(
        `ALTER TYPE "public"."moderation_action_enum" ADD VALUE 'UNBAN_USER'`,
      );
    }
    if (!(await checkValue("BLOCK_IP"))) {
      await queryRunner.query(
        `ALTER TYPE "public"."moderation_action_enum" ADD VALUE 'BLOCK_IP'`,
      );
    }
    if (!(await checkValue("UNBLOCK_IP"))) {
      await queryRunner.query(
        `ALTER TYPE "public"."moderation_action_enum" ADD VALUE 'UNBLOCK_IP'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removed values cannot be easily dropped from Enum in Postgres without recreating the type
  }
}
