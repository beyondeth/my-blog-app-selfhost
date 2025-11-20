import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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

  // CreatePostDto에서 상속받는 필드들 (tags, thumbnailImageId 등)
  // PartialType 덕분에 자동으로 옵셔널 처리됨
}