import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityImageFitPreferences1790400000001
  implements MigrationInterface
{
  name = "AddCommunityImageFitPreferences1790400000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "iconImageFit" character varying(20) NOT NULL DEFAULT 'contain'`,
    );
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "bannerImageFit" character varying(20) NOT NULL DEFAULT 'cover'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN "bannerImageFit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN "iconImageFit"`,
    );
  }
}
