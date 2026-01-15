import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class AddTagSystem1757147537858 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tags table
    await queryRunner.createTable(
      new Table({
        name: "tags",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "name",
            type: "varchar",
            isUnique: true,
          },
          {
            name: "slug",
            type: "varchar",
            isUnique: true,
          },
          {
            name: "postCount",
            type: "int",
            default: 0,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    // Indexes are already created with isUnique: true in the table definition
    // No need for additional index creation

    // Create post_tags junction table
    await queryRunner.createTable(
      new Table({
        name: "post_tags",
        columns: [
          {
            name: "postId",
            type: "uuid",
          },
          {
            name: "tagId",
            type: "uuid",
          },
        ],
        foreignKeys: [
          {
            columnNames: ["postId"],
            referencedTableName: "posts",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
          {
            columnNames: ["tagId"],
            referencedTableName: "tags",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
        ],
      }),
      true,
    );

    // Indexes will be created with foreign keys

    // Create composite primary key
    await queryRunner.createPrimaryKey("post_tags", ["postId", "tagId"]);

    // Migrate existing tags data
    // First, get all unique tags from posts
    const posts = await queryRunner.query(`
      SELECT id, tags 
      FROM posts 
      WHERE tags IS NOT NULL AND tags != ''
    `);

    // Collect all unique tags
    const uniqueTags = new Set<string>();
    for (const post of posts) {
      const tags = post.tags
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase());
      tags.forEach((tag: string) => uniqueTags.add(tag));
    }

    // Insert unique tags into tags table
    for (const tagName of uniqueTags) {
      if (tagName) {
        const slug = tagName
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        await queryRunner.query(
          `INSERT INTO tags (id, name, slug, "postCount", "createdAt", "updatedAt") 
           VALUES (uuid_generate_v4(), $1, $2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (name) DO NOTHING`,
          [tagName, slug],
        );
      }
    }

    // Create relationships in post_tags table
    for (const post of posts) {
      const tags = post.tags
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase());

      for (const tagName of tags) {
        if (tagName) {
          // Get tag id
          const tagResult = await queryRunner.query(
            `SELECT id FROM tags WHERE name = $1`,
            [tagName],
          );

          if (tagResult.length > 0) {
            // Insert into post_tags
            await queryRunner.query(
              `INSERT INTO post_tags ("postId", "tagId") 
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [post.id, tagResult[0].id],
            );
          }
        }
      }
    }

    // Update post counts for all tags
    await queryRunner.query(`
      UPDATE tags 
      SET "postCount" = (
        SELECT COUNT(*) 
        FROM post_tags 
        WHERE post_tags."tagId" = tags.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop post_tags table
    await queryRunner.dropTable("post_tags");

    // Drop tags table
    await queryRunner.dropTable("tags");
  }
}
