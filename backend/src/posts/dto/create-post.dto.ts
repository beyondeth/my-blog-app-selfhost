import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: '블로그 포스트 제목',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: '게시글 내용 (HTML 형식 또는 마크다운이 변환된 HTML)',
    example: '게시글의 상세 내용...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '썸네일 이미지 URL',
    example: 'https://example.com/thumbnail.jpg',
  })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({
    description: '태그 배열',
    example: ['javascript', 'nodejs', 'nestjs'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '카테고리',
    example: '개발',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: '첨부 파일 ID 배열 (UUID)',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedFileIds?: string[];

  @ApiPropertyOptional({
    description: '마크다운 원본 내용 (하이브리드 저장용)',
    example: '# 제목\n\n마크다운 **내용**...',
  })
  @IsOptional()
  @IsString()
  content_markdown?: string;
} 