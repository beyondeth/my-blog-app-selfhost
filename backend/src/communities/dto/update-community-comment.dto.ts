import { IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

/**
 * 커뮤니티 댓글 수정 DTO
 *
 * @description 댓글 내용 수정 요청 시 사용
 * 댓글 수정 시 수정 시간이 자동으로 기록됩니다.
 */
export class UpdateCommunityCommentDto {
  @ApiProperty({
    description: "수정할 댓글 내용 (1-10,000자)",
    example: "수정된 댓글 내용입니다.",
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1, { message: "댓글 내용은 최소 1자 이상이어야 합니다" })
  @MaxLength(10000, { message: "댓글 내용은 최대 10,000자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  content: string;
}
