import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedAtToPosts1761200000000 implements MigrationInterface {
    name = 'AddDeletedAtToPosts1761200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts" ADD "deletedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "deletedAt"`);
    }
}