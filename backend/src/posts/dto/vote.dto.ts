import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { VoteType } from "../enums/vote-type.enum";

/**
 * 투표 요청 DTO
 */
export class VoteDto {
  @ApiProperty({
    description: "투표 타입",
    enum: VoteType,
    example: VoteType.UPVOTE,
  })
  @IsNotEmpty({ message: "투표 타입은 필수입니다" })
  @IsEnum(VoteType, {
    message: "유효한 투표 타입이어야 합니다 (upvote/downvote)",
  })
  type: VoteType;
}

/**
 * 투표 응답 DTO
 */
export class VoteResponseDto {
  @ApiProperty({
    description: "수행된 액션",
    enum: ["added", "removed", "changed"],
    example: "added",
  })
  action: "added" | "removed" | "changed";

  @ApiProperty({
    description: "사용자의 현재 투표 상태",
    enum: VoteType,
    nullable: true,
    example: VoteType.UPVOTE,
  })
  userVote: VoteType | null;

  @ApiProperty({
    description: "업보트 수",
    example: 42,
  })
  upvoteCount: number;

  @ApiProperty({
    description: "다운보트 수",
    example: 3,
  })
  downvoteCount: number;

  @ApiProperty({
    description: "순투표 점수 (upvoteCount - downvoteCount)",
    example: 39,
  })
  score: number;

  @ApiProperty({
    description: "좋아요 여부 (하위 호환성)",
    deprecated: true,
    example: true,
  })
  liked?: boolean;

  @ApiProperty({
    description: "좋아요 수 (하위 호환성)",
    deprecated: true,
    example: 42,
  })
  likeCount?: number;
}
