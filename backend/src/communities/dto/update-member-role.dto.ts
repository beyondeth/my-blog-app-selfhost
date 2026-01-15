import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CommunityRole } from "../enums";

/**
 * 커뮤니티 멤버 역할 변경 DTO (4단계 역할 시스템)
 *
 * @description 커뮤니티 멤버의 역할을 변경할 때 사용
 *
 * **권한:**
 * - OWNER만 ADMIN 역할 부여/해제 가능
 * - OWNER 또는 ADMIN이 MODERATOR 역할 부여/해제 가능
 * - OWNER 역할은 이 API로 변경 불가 (별도 transferOwnership API 사용)
 */
export class UpdateMemberRoleDto {
  @ApiProperty({
    description: "변경할 역할",
    enum: [CommunityRole.MEMBER, CommunityRole.MODERATOR, CommunityRole.ADMIN],
    example: CommunityRole.MODERATOR,
  })
  @IsEnum(
    [CommunityRole.MEMBER, CommunityRole.MODERATOR, CommunityRole.ADMIN],
    {
      message: "역할은 MEMBER, MODERATOR 또는 ADMIN만 지정할 수 있습니다",
    },
  )
  role: CommunityRole.MEMBER | CommunityRole.MODERATOR | CommunityRole.ADMIN;
}
