import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityMemberModeratorIndex1793200000000
  implements MigrationInterface
{
  name = "AddCommunityMemberModeratorIndex1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_community_member_comm_status_role_joined" ON "community_members" ("communityId", "status", "role", "joinedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_community_member_comm_status_role_joined"`,
    );
  }
}
