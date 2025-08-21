import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddFileContextSystem1755449121217 implements MigrationInterface {
  name = 'AddFileContextSystem1755449121217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create file_contexts table
    await queryRunner.createTable(
      new Table({
        name: 'file_contexts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'context_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'context_id',
            type: 'uuid',
          },
          {
            name: 'purpose',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'max_files',
            type: 'int',
            default: 10,
          },
          {
            name: 'file_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_size',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'max_file_size',
            type: 'bigint',
            default: 10485760, // 10MB
          },
          {
            name: 'allowed_mime_types',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'archived_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // 2. Create indexes on file_contexts
    await queryRunner.query(`
      CREATE INDEX "IDX_FILE_CONTEXT_TYPE" ON "file_contexts" ("context_type", "context_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_FILE_CONTEXT_PURPOSE" ON "file_contexts" ("purpose")
    `);

    // 3. Add new columns to files table
    await queryRunner.query(`
      ALTER TABLE "files" 
      ADD COLUMN IF NOT EXISTS "context_id" uuid,
      ADD COLUMN IF NOT EXISTS "s3_bucket" varchar,
      ADD COLUMN IF NOT EXISTS "s3_region" varchar,
      ADD COLUMN IF NOT EXISTS "checksum" varchar,
      ADD COLUMN IF NOT EXISTS "is_optimized" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb,
      ADD COLUMN IF NOT EXISTS "expires_at" timestamp
    `);

    // 4. Create indexes on files table (skip if they already exist)
    const fileIndexes = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'files' 
      AND schemaname = 'public'
    `);
    
    const existingIndexNames = fileIndexes.map((idx: any) => idx.indexname);
    
    if (!existingIndexNames.includes('idx_files_context_id')) {
      await queryRunner.query(`
        CREATE INDEX "IDX_FILES_CONTEXT_ID" ON "files" ("context_id")
      `);
    }

    // 5. Add foreign key constraint from files to file_contexts
    const foreignKeys = await queryRunner.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'files' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'FK_FILES_CONTEXT'
    `);

    if (foreignKeys.length === 0) {
      await queryRunner.createForeignKey(
        'files',
        new TableForeignKey({
          name: 'FK_FILES_CONTEXT',
          columnNames: ['context_id'],
          referencedTableName: 'file_contexts',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    // 6. Create file_lifecycle_events table for audit trail
    await queryRunner.createTable(
      new Table({
        name: 'file_lifecycle_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'file_id',
            type: 'uuid',
          },
          {
            name: 'event_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'event_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // 7. Create index on lifecycle events
    await queryRunner.query(`
      CREATE INDEX "IDX_FILE_LIFECYCLE_FILE_ID" ON "file_lifecycle_events" ("file_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_FILE_LIFECYCLE_EVENT_TYPE" ON "file_lifecycle_events" ("event_type")
    `);

    // 8. Add foreign key for lifecycle events
    await queryRunner.createForeignKey(
      'file_lifecycle_events',
      new TableForeignKey({
        name: 'FK_FILE_LIFECYCLE_FILE',
        columnNames: ['file_id'],
        referencedTableName: 'files',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('file_lifecycle_events', 'FK_FILE_LIFECYCLE_FILE');
    await queryRunner.dropForeignKey('files', 'FK_FILES_CONTEXT');

    // Drop tables
    await queryRunner.dropTable('file_lifecycle_events');
    await queryRunner.dropTable('file_contexts');

    // Remove columns from files table
    await queryRunner.query(`
      ALTER TABLE "files" 
      DROP COLUMN IF EXISTS "context_id",
      DROP COLUMN IF EXISTS "s3_bucket",
      DROP COLUMN IF EXISTS "s3_region",
      DROP COLUMN IF EXISTS "checksum",
      DROP COLUMN IF EXISTS "is_optimized",
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "expires_at"
    `);
  }
}