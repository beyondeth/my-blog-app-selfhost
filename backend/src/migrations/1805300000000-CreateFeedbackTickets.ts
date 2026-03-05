import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateFeedbackTickets1805300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "feedback_tickets",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
          },
          {
            name: "user_id",
            type: "uuid",
          },
          {
            name: "mode",
            type: "varchar",
            length: "20",
            default: "'form'",
          },
          {
            name: "type",
            type: "varchar",
            length: "50",
            isNullable: true,
          },
          {
            name: "title",
            type: "varchar",
            length: "255",
          },
          {
            name: "message",
            type: "text",
          },
          {
            name: "page_path",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
          {
            name: "theme",
            type: "varchar",
            length: "20",
            isNullable: true,
          },
          {
            name: "user_agent",
            type: "text",
            isNullable: true,
          },
          {
            name: "status",
            type: "varchar",
            length: "30",
            default: "'new'",
          },
          {
            name: "email_sent",
            type: "boolean",
            default: false,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      "feedback_tickets",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createIndex(
      "feedback_tickets",
      new TableIndex({
        name: "IDX_FEEDBACK_USER_ID",
        columnNames: ["user_id"],
      })
    );

    await queryRunner.createIndex(
      "feedback_tickets",
      new TableIndex({
        name: "IDX_FEEDBACK_STATUS",
        columnNames: ["status"],
      })
    );

    await queryRunner.createIndex(
      "feedback_tickets",
      new TableIndex({
        name: "IDX_FEEDBACK_CREATED_AT",
        columnNames: ["created_at"],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("feedback_tickets");
  }
}
