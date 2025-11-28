import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max, MaxLength, IsIn } from 'class-validator';

/**
 * 음악 파일 업로드 URL 생성 요청 DTO
 * 관리자만 사용 가능
 */
export class CreateMusicUploadUrlDto {
  @ApiProperty({
    description: '원본 파일명',
    example: 'my-song.mp3',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: '파일 크기 (bytes)',
    example: 5242880,
    minimum: 1,
    maximum: 52428800, // 50MB
  })
  @IsNumber()
  @Min(1)
  @Max(52428800)
  fileSize: number;

  @ApiProperty({
    description: 'MIME 타입',
    example: 'audio/mpeg',
    enum: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a', 'audio/aac'],
  })
  @IsString()
  @IsIn(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a', 'audio/aac'])
  mimeType: string;
}
