import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditActionEnum1767963059573 implements MigrationInterface {
    name = 'UpdateAuditActionEnum1767963059573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const checkValue = async (value: string) => {
             const result = await queryRunner.query(`
                SELECT 1 FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid 
                WHERE t.typname = 'audit_logs_action_enum' AND e.enumlabel = '${value}'
            `);
            return result.length > 0;
        };

        const valuesToAdd = ['ip_view', 'ip_export', 'ip_block', 'ip_unblock'];

        for (const value of valuesToAdd) {
            if (!(await checkValue(value))) {
                await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE '${value}'`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres enums require dropping/recreating to remove values, skipping for safety/irreversibility in simple checks
    }
}
