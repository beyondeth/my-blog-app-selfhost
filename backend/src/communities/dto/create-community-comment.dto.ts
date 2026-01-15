import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

/**
 * 커뮤니티 댓글 생성 DTO
 *
 * @description 커뮤니티 게시물에 댓글/대댓글 생성 요청 시 사용
 *
 * **대댓글:**
 * - parentCommentId 제공 시 해당 댓글의 대댓글로 생성
 * - 대댓글 깊이 제한은 서비스 레이어에서 처리
 */
export class CreateCommunityCommentDto {
  @ApiProperty({
    description: "댓글 내용 (1-10,000자)",
    example: "좋은 글 감사합니다!",
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1, { message: "댓글 내용은 최소 1자 이상이어야 합니다" })
  @MaxLength(10000, { message: "댓글 내용은 최대 10,000자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  content: string;

  @ApiPropertyOptional({
    description: "부모 댓글 ID (대댓글인 경우)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsUUID(undefined, {
    message: "부모 댓글 ID는 유효한 UUID 형식이어야 합니다",
  })
  parentCommentId?: string;
}
