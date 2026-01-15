import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumnsToPostLikes1777100000000
  implements MigrationInterface
{
  name = "AddMissingColumnsToPostLikes1777100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      // 테이블이 존재하는지 확인
      const tableExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'post_likes'
                );
            `);

      if (!tableExists[0].exists) {
        console.log("Post likes table does not exist, skipping migration");
        return;
      }

      // 기존 데이터 백업
      const existingData = await queryRunner.query(`
                SELECT "postId", "userId" FROM post_likes
            `);

      // 기존 복합 기본 키 제약조건 확인 및 제거
      const constraints = await queryRunner.query(`
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'post_likes'::regclass
                AND contype = 'p'
            `);

      for (const constraint of constraints) {
        try {
          await queryRunner.query(
            `ALTER TABLE post_likes DROP CONSTRAINT "${constraint.conname}"`,
          );
        } catch (error) {
          // 제약조건이 이미 없거나 다른 이름일 경우 무시
          console.log(
            `Could not drop constraint ${constraint.conname}:`,
            error.message,
          );
        }
      }

      // ENUM 타입 생성
      try {
        await queryRunner.query(`
                    DO $$ BEGIN
                        CREATE TYPE post_like_type AS ENUM ('like', 'dislike');
                    EXCEPTION
                        WHEN duplicate_object THEN null;
                    END $$;
                `);
      } catch (error) {
        console.log(
          "Enum type already exists or creation failed:",
          error.message,
        );
      }

      // 컬럼 추가 - queryRunner.query 사용
      await queryRunner.query(`
                ALTER TABLE post_likes
                ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid()
            `);

      await queryRunner.query(`
                ALTER TABLE post_likes
                ADD COLUMN type post_like_type NOT NULL DEFAULT 'like'
            `);

      await queryRunner.query(`
                ALTER TABLE post_likes
                ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            `);

      // 기존 데이터 업데이트
      if (existingData.length > 0) {
        for (const row of existingData) {
          await queryRunner.query(
            `
                        UPDATE post_likes
                        SET
                            type = 'like',
                            "createdAt" = CURRENT_TIMESTAMP
                        WHERE "postId" = $1 AND "userId" = $2
                    `,
            [row.postId, row.userId],
          );
        }
      }

      // 인덱스 추가
      await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_post_likes_userId"
                ON post_likes ("userId")
            `);

      await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_post_likes_postId"
                ON post_likes ("postId")
            `);

      await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_post_likes_type"
                ON post_likes (type)
            `);

      // 고유 제약조건 (사용자당 포스트당 타입별 하나만)
      await queryRunner.query(`
                ALTER TABLE post_likes
                ADD CONSTRAINT "UQ_post_likes_user_post_type"
                UNIQUE ("userId", "postId", "type")
            `);

      console.log(
        `Successfully migrated ${existingData.length} existing post_likes records`,
      );
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      // 테이블이 존재하는지 확인
      const tableExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'post_likes'
                );
            `);

      if (!tableExists[0].exists) {
        console.log("Post likes table does not exist, skipping rollback");
        return;
      }

      // 인덱스 제거
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_likes_type"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_likes_postId"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_likes_userId"`);

      // 제약조건 제거
      try {
        await queryRunner.query(
          `ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS "UQ_post_likes_user_post_type"`,
        );
        await queryRunner.query(
          `ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS "PK_post_likes"`,
        );
      } catch (error) {
        console.log("Could not drop constraints:", error.message);
      }

      // 컬럼 제거
      await queryRunner.query(
        `ALTER TABLE post_likes DROP COLUMN IF EXISTS "createdAt"`,
      );
      await queryRunner.query(
        `ALTER TABLE post_likes DROP COLUMN IF EXISTS type`,
      );
      await queryRunner.query(
        `ALTER TABLE post_likes DROP COLUMN IF EXISTS id`,
      );

      // 복합 기본 키 다시 생성
      await queryRunner.query(`
                ALTER TABLE post_likes
                ADD CONSTRAINT "PK_post_likes"
                PRIMARY KEY ("postId", "userId")
            `);

      // ENUM 타입 제거
      try {
        await queryRunner.query(`DROP TYPE IF EXISTS post_like_type`);
      } catch (error) {
        console.log("Could not drop enum type:", error.message);
      }

      console.log("Successfully rolled back post_likes table");
    } catch (error) {
      console.error("Rollback failed:", error);
      throw error;
    }
  }
}
