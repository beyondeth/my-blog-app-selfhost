import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyApiKeyDto {
  @ApiProperty({ description: '요청 타임스탬프 (Unix timestamp in milliseconds)' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: '일회용 논스 (재사용 방지)' })
  @IsString()
  @IsNotEmpty()
  nonce: string;

  @ApiProperty({ description: 'HMAC-SHA256 서명' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: 'API 키 ID (평문 키가 아님)' })
  @IsString()
  @IsNotEmpty()
  keyId: string;
}