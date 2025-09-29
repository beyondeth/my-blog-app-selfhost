import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNameAndStripeCustomerId1759090000000 implements MigrationInterface {
    name = 'AddNameAndStripeCustomerId1759090000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // users 테이블에 name 컬럼 추가
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" character varying(100)`);

        // users 테이블에 stripeCustomerId 컬럼 추가
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripeCustomerId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "name"`);
    }
}