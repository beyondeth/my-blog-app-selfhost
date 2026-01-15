/**
 * 비디오 업로드 완료 알림 DTO
 *
 * 클라이언트가 R2에 직접 업로드 완료 후 호출
 * BullMQ Job 생성 트리거
 */

import { IsString, IsNumber, MaxLength, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VideoUploadCompleteDto {
  @ApiProperty({
    description: "R2 파일 키 (Presigned URL 생성 시 받은 값)",
    example: "videos/raw/550e8400-e29b-41d4-a716-446655440000.mp4",
  })
  @IsString()
  @MaxLength(512)
  fileKey: string;

  @ApiProperty({
    description: "원본 파일명",
    example: "my-video.mp4",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: "실제 업로드된 파일 크기 (bytes)",
    example: 52428800,
    minimum: 1,
    maximum: 104857600,
  })
  @IsNumber()
  @Min(1)
  @Max(104857600)
  fileSize: number;
}
