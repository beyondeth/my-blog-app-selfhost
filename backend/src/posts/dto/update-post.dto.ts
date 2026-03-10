import { PartialType } from "@nestjs/swagger";
import { CreatePostDto } from "./create-post.dto";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsIn,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class UpdatePostDto extends PartialType(CreatePostDto) {
  // 상속받은 필수 필드들을 옵셔널로 명시적으로 지정
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  content_markdown?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  version?: number;

  @IsOptional()
  @IsBoolean()
  isEditorPick?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn(["public", "private"])
  visibility?: "public" | "private";

  @IsOptional()
  @IsString()
  githubUrl?: string;

  @IsOptional()
  @IsString()
  githubDescription?: string;

  /**
   * 업데이트 경로에서 썸네일 제거를 지원하기 위해 오버라이드
   * - "" -> null 로 정규화
   * - null 은 isOptional로 허용되어 제거 의도로 전달됨
   * - string 값은 UUID v4 검증
   */
  @IsOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsUUID("4", { message: "썸네일 ID는 유효한 UUID v4 형식이어야 합니다" })
  thumbnailImageId?: string | null;

  // CreatePostDto에서 상속받는 필드들 (tags, attachedFileIds 등)
  // PartialType 덕분에 자동으로 옵셔널 처리됨
}
