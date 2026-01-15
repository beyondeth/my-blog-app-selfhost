import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateSuspiciousRequestsTable1757649879203
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "suspicious_requests",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "requestType",
            type: "varchar",
            length: "50",
          },
          {
            name: "ipAddress",
            type: "varchar",
            length: "45",
          },
          {
            name: "endpoint",
            type: "varchar",
            length: "255",
          },
          {
            name: "userId",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "userEmail",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "requestDetails",
            type: "jsonb",
          },
          {
            name: "userAgent",
            type: "text",
            isNullable: true,
          },
          {
            name: "reason",
            type: "varchar",
            length: "500",
          },
          {
            name: "severity",
            type: "varchar",
            length: "20",
            default: "'WARNING'",
          },
          {
            name: "isResolved",
            type: "boolean",
            default: false,
          },
          {
            name: "resolvedNote",
            type: "text",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "resolvedAt",
            type: "timestamptz",
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      "suspicious_requests",
      new TableIndex({
        name: "IDX_suspicious_requests_type_date",
        columnNames: ["requestType", "createdAt"],
      }),
    );

    await queryRunner.createIndex(
      "suspicious_requests",
      new TableIndex({
        name: "IDX_suspicious_requests_ip_date",
        columnNames: ["ipAddress", "createdAt"],
      }),
    );

    await queryRunner.createIndex(
      "suspicious_requests",
      new TableIndex({
        name: "IDX_suspicious_requests_severity",
        columnNames: ["severity"],
      }),
    );

    await queryRunner.createIndex(
      "suspicious_requests",
      new TableIndex({
        name: "IDX_suspicious_requests_resolved",
        columnNames: ["isResolved"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      "suspicious_requests",
      "IDX_suspicious_requests_resolved",
    );
    await queryRunner.dropIndex(
      "suspicious_requests",
      "IDX_suspicious_requests_severity",
    );
    await queryRunner.dropIndex(
      "suspicious_requests",
      "IDX_suspicious_requests_ip_date",
    );
    await queryRunner.dropIndex(
      "suspicious_requests",
      "IDX_suspicious_requests_type_date",
    );
    await queryRunner.dropTable("suspicious_requests");
  }
}
