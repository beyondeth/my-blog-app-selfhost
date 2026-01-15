import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, Min } from "class-validator";

/**
 * 음악 파일 업로드 완료 알림 DTO
 * S3 업로드 완료 후 메타데이터 추출 및 DB 저장 트리거
 */
export class MusicUploadCompleteDto {
  @ApiProperty({
    description: "S3 파일 키",
    example: "uploads/music/2024/01/abc123.mp3",
  })
  @IsString()
  fileKey: string;

  @ApiProperty({
    description: "원본 파일명",
    example: "my-song.mp3",
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: "파일 크기 (bytes)",
    example: 5242880,
  })
  @IsNumber()
  @Min(1)
  fileSize: number;

  @ApiProperty({
    description: "MIME 타입",
    example: "audio/mpeg",
  })
  @IsString()
  mimeType: string;
}
