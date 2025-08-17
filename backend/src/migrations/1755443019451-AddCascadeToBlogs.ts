import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeToBlogs1755443019451 implements MigrationInterface {
    name = 'AddCascadeToBlogs1755443019451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "blogs" DROP CONSTRAINT "FK_50205032574e0b039d655f6cfd3"`);
        await queryRunner.query(`ALTER TABLE "blogs" ADD CONSTRAINT "FK_50205032574e0b039d655f6cfd3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "blogs" DROP CONSTRAINT "FK_50205032574e0b039d655f6cfd3"`);
        await queryRunner.query(`ALTER TABLE "blogs" ADD CONSTRAINT "FK_50205032574e0b039d655f6cfd3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
