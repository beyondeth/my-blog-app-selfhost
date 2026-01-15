import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 이미지 업로드를 위한 FileContext Enum 확장
 *
 * 변경사항:
 * 1. file_contexts_contexttype_enum에 'community' 추가
 * 2. file_contexts_purpose_enum에 'icon' 추가
 *
 * 이 마이그레이션은 V2 ContextualFile 시스템에서 커뮤니티 이미지
 * (아이콘, 배너) 업로드를 지원하기 위해 필요합니다.
 */
export class AddCommunityFileContextEnums1781000000001
  implements MigrationInterface
{
  name = "AddCommunityFileContextEnums1781000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. file_contexts_contexttype_enum에 'community' 추가
    // PostgreSQL에서 enum에 값을 추가하는 방법
    await queryRunner.query(`
      ALTER TYPE "public"."file_contexts_contexttype_enum"
      ADD VALUE IF NOT EXISTS 'community'
    `);

    // 2. file_contexts_purpose_enum에 'icon' 추가
    await queryRunner.query(`
      ALTER TYPE "public"."file_contexts_purpose_enum"
      ADD VALUE IF NOT EXISTS 'icon'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL에서 enum 값 제거는 복잡함
    // 보통 enum 타입을 재생성해야 함
    // 이 마이그레이션은 되돌리지 않는 것을 권장

    // 주의: 이 down 마이그레이션은 기존 데이터가 있으면 실패할 수 있음
    // 실제 운영 환경에서는 신중하게 처리해야 함

    // file_contexts 테이블에서 community 타입 사용 데이터 확인
    const communityContexts = await queryRunner.query(`
      SELECT COUNT(*) FROM "file_contexts" WHERE "contextType" = 'community'
    `);

    if (Number(communityContexts[0]?.count) > 0) {
      throw new Error("Cannot revert: community context type is still in use");
    }

    // file_contexts 테이블에서 icon purpose 사용 데이터 확인
    const iconPurposes = await queryRunner.query(`
      SELECT COUNT(*) FROM "file_contexts" WHERE "purpose" = 'icon'
    `);

    if (Number(iconPurposes[0]?.count) > 0) {
      throw new Error("Cannot revert: icon purpose is still in use");
    }

    // enum 값 제거 (데이터가 없는 경우에만)
    // 참고: PostgreSQL 9.1+ 에서 enum 값 제거는 지원되지 않음
    // 필요시 새 enum 타입을 만들고 컬럼을 마이그레이션해야 함
    console.log("Warning: Enum values cannot be removed in PostgreSQL");
    console.log("Manual intervention may be required to fully revert");
  }
}
