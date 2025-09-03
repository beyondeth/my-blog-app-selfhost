import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageOrderingFields1756900000000 implements MigrationInterface {
  name = 'AddImageOrderingFields1756900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add thumbnail_image_id column to posts table
    await queryRunner.addColumn('posts', new TableColumn({
      name: 'thumbnail_image_id',
      type: 'uuid',
      isNullable: true,
    }));

    // Add image_order column to post_files junction table
    await queryRunner.addColumn('post_files', new TableColumn({
      name: 'image_order',
      type: 'int',
      isNullable: true,
      default: 0,
    }));

    // Add created_at column to post_files junction table for better tracking
    await queryRunner.addColumn('post_files', new TableColumn({
      name: 'created_at',
      type: 'timestamp',
      default: 'CURRENT_TIMESTAMP',
    }));

    // Create index for image_order for better query performance
    await queryRunner.query(`
      CREATE INDEX IDX_post_files_image_order ON post_files ("postId", image_order)
    `);

    // Create foreign key constraint for thumbnail_image_id
    await queryRunner.query(`
      ALTER TABLE posts 
      ADD CONSTRAINT FK_posts_thumbnail_image_id 
      FOREIGN KEY (thumbnail_image_id) REFERENCES files(id) 
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE posts DROP CONSTRAINT FK_posts_thumbnail_image_id
    `);

    // Drop index
    await queryRunner.query('DROP INDEX IF EXISTS IDX_post_files_image_order');

    // Drop columns
    await queryRunner.dropColumn('posts', 'thumbnail_image_id');
    await queryRunner.dropColumn('post_files', 'image_order');
    await queryRunner.dropColumn('post_files', 'created_at');
  }
}