import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMcpPostEnum1759346736462 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // usage_tracking 테이블의 resourceType enum에 mcp_post 값 추가
    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'mcp_post'
                    AND enumtypid = (
                        SELECT oid FROM pg_type WHERE typname = 'usage_tracking_resourcetype_enum'
                    )
                ) THEN
                    ALTER TYPE usage_tracking_resourcetype_enum ADD VALUE 'mcp_post';
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL에서 enum 값 제거는 복잡하므로 경고 메시지만 출력
    console.warn(
      'Warning: Cannot remove enum value "mcp_post" from usage_tracking_resourcetype_enum. Manual intervention required if rollback is needed.',
    );
  }
}
