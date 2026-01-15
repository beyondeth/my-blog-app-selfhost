import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedAtToComment1767798480428 implements MigrationInterface {
    name = 'AddDeletedAtToComment1767798480428'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" ADD "deletedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "deletedAt"`);
    }
}
