import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  version?: number;

  @IsOptional()
  @IsBoolean()
  isEditorPick?: boolean;

  // thumbnail은 CreatePostDto에서 이미 정의되어 있으므로 중복 정의 제거
  // thumbnailImageId도 CreatePostDto에서 상속받음

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}