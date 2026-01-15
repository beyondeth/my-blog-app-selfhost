import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRedirectToOldAliases1761100000000
  implements MigrationInterface
{
  name = "AddRedirectToOldAliases1761100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "old_aliases",
      new TableColumn({
        name: "redirectto",
        type: "varchar",
        length: "100",
        isNullable: true,
        default: null,
      }),
    );

    // 기존 데이터가 있다면 blog의 현재 alias로 redirectto를 채움
    await queryRunner.query(`
      UPDATE old_aliases oa
      SET redirectto = b.alias
      FROM blogs b
      WHERE oa."blogId" = b.id
      AND oa.redirectto IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("old_aliases", "redirectto");
  }
}
