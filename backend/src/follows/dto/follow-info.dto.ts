import { ApiProperty } from "@nestjs/swagger";

export class FollowInfoDto {
  @ApiProperty({ description: "팔로워 수" })
  followersCount: number;

  @ApiProperty({ description: "팔로잉 수" })
  followingCount: number;

  @ApiProperty({ description: "현재 사용자가 팔로우 중인지 여부" })
  isFollowedByUser: boolean;
}
