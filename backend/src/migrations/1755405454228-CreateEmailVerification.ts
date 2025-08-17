import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateEmailVerification1755405454228 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'email_verifications',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'code',
                        type: 'varchar',
                        length: '6',
                    },
                    {
                        name: 'isVerified',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'attemptCount',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'expiresAt',
                        type: 'timestamp',
                    },
                    {
                        name: 'verifiedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'sessionToken',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // 인덱스 생성
        await queryRunner.query(
            `CREATE INDEX "IDX_EMAIL_CODE" ON "email_verifications" ("email", "code")`
        );

        await queryRunner.query(
            `CREATE INDEX "IDX_EXPIRES_AT" ON "email_verifications" ("expiresAt")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_EMAIL_CODE"`);
        await queryRunner.query(`DROP INDEX "IDX_EXPIRES_AT"`);
        await queryRunner.dropTable('email_verifications');
    }
}