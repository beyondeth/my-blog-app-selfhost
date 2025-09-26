import { IsString, IsArray, IsOptional, Length, ArrayMinSize, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth 클라이언트 생성 DTO
 */
export class CreateClientDto {
  @ApiProperty({
    description: '클라이언트 애플리케이션 이름',
    example: 'My MCP Blog Client',
  })
  @IsString()
  @Length(3, 100)
  clientName: string;

  @ApiProperty({
    description: '허용된 리다이렉트 URI 목록',
    example: ['http://localhost:8080/callback'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  // URL 패턴 검증을 더 간단하게 수정 - http:// 또는 https://로 시작하기만 하면 됨
  @Matches(
    /^https?:\/\/.+$/,
    {
      each: true,
      message: '유효한 HTTP(S) URL 형식이어야 합니다 (예: http://localhost:7777/callback)'
    }
  )
  redirectUris: string[];

  @ApiProperty({
    description: '클라이언트 설명',
    example: '블로그 자동 포스팅을 위한 MCP 클라이언트',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({
    description: '허용할 OAuth 스코프 목록',
    example: ['mcp:post:create'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedScopes?: string[];
}