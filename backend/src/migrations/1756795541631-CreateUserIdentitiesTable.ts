import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserIdentitiesTable1756795541631 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create user_identities table
        await queryRunner.createTable(
            new Table({
                name: 'user_identities',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'userId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'provider',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'providerId',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'providerEmail',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'providerData',
                        type: 'jsonb',
                        isNullable: true,
                    },
                    {
                        name: 'linkedAt',
                        type: 'timestamptz',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'lastUsedAt',
                        type: 'timestamptz',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
                foreignKeys: [
                    {
                        name: 'FK_user_identities_user',
                        columnNames: ['userId'],
                        referencedTableName: 'users',
                        referencedColumnNames: ['id'],
                        onDelete: 'CASCADE',
                    },
                ],
                uniques: [
                    {
                        name: 'UQ_provider_providerId',
                        columnNames: ['provider', 'providerId'],
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            'user_identities',
            new TableIndex({
                name: 'IDX_user_identities_userId',
                columnNames: ['userId'],
            })
        );

        await queryRunner.createIndex(
            'user_identities',
            new TableIndex({
                name: 'IDX_user_identities_provider',
                columnNames: ['provider'],
            })
        );

        // Add columns to users table for multi-identity support
        await queryRunner.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS "primaryIdentityId" uuid,
            ADD COLUMN IF NOT EXISTS "lastLoginProvider" varchar(50),
            ADD COLUMN IF NOT EXISTS "accountVerifiedAt" timestamptz,
            ADD COLUMN IF NOT EXISTS "accountSecurityLevel" varchar(20) DEFAULT 'basic'
        `);

        // Add foreign key for primaryIdentityId
        await queryRunner.query(`
            ALTER TABLE users 
            ADD CONSTRAINT "FK_users_primary_identity" 
            FOREIGN KEY ("primaryIdentityId") 
            REFERENCES user_identities(id) 
            ON DELETE SET NULL
        `);

        // Update AuthProvider enum to include GitHub
        await queryRunner.query(`
            ALTER TYPE "users_authprovider_enum" ADD VALUE IF NOT EXISTS 'github'
        `);

        // Migrate existing OAuth users to user_identities table
        await queryRunner.query(`
            INSERT INTO user_identities ("userId", provider, "providerId", "providerEmail", "linkedAt", "lastUsedAt")
            SELECT 
                id as "userId",
                "authProvider" as provider,
                "providerId" as "providerId",
                email as "providerEmail",
                "createdAt" as "linkedAt",
                COALESCE("lastLoginAt", "createdAt") as "lastUsedAt"
            FROM users
            WHERE "authProvider" != 'local' 
            AND "providerId" IS NOT NULL
            ON CONFLICT DO NOTHING
        `);

        // Set primaryIdentityId for existing OAuth users
        await queryRunner.query(`
            UPDATE users u
            SET "primaryIdentityId" = (
                SELECT id FROM user_identities ui
                WHERE ui."userId" = u.id
                ORDER BY ui."linkedAt" ASC
                LIMIT 1
            )
            WHERE EXISTS (
                SELECT 1 FROM user_identities ui
                WHERE ui."userId" = u.id
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key from users table
        await queryRunner.query(`
            ALTER TABLE users 
            DROP CONSTRAINT IF EXISTS "FK_users_primary_identity"
        `);

        // Remove added columns from users table
        await queryRunner.query(`
            ALTER TABLE users 
            DROP COLUMN IF EXISTS "primaryIdentityId",
            DROP COLUMN IF EXISTS "lastLoginProvider",
            DROP COLUMN IF EXISTS "accountVerifiedAt",
            DROP COLUMN IF EXISTS "accountSecurityLevel"
        `);

        // Drop indexes
        await queryRunner.dropIndex('user_identities', 'IDX_user_identities_userId');
        await queryRunner.dropIndex('user_identities', 'IDX_user_identities_provider');

        // Drop table
        await queryRunner.dropTable('user_identities');
    }
}