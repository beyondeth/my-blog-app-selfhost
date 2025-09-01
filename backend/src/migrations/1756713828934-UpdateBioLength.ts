import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateBioLength1756713828934 implements MigrationInterface {
    name = 'UpdateBioLength1756713828934'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(1000)`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(500)`);
    }

}
