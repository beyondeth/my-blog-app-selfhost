import { IsString, IsOptional, IsArray, IsNumber, Min, Max, MaxLength, Matches } from 'class-validator';
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

  @ApiProperty({
    description: '카테고리 (필수, 최대 2단계, 각 카테고리는 1~15글자)',
    example: 'JavaScript/React',
  })
  @IsString()
  @Matches(/^.{1,15}$|^.{1,15}\/.{1,15}$/, {
    message: '카테고리는 최대 2단계까지 가능하며, 각 카테고리는 1~15글자여야 합니다 (예: JavaScript/React)'
  })
  category: string;

  @ApiPropertyOptional({
    description: '첨부 파일 ID 배열 (UUID)',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedFileIds?: string[];

  @ApiPropertyOptional({
    description: '마크다운 원본 내용 (하이브리드 저장용, 최대 200,000자)',
    example: '# 제목\n\n마크다운 **내용**...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200000, { message: '포스트 내용은 최대 200,000자까지 가능합니다' })
  content_markdown?: string;

  @ApiPropertyOptional({
    description: '콘텐츠 품질 점수 (0-100, MCP 서버에서 자동 계산)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;
} 