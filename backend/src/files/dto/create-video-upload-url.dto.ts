/**
 * 비디오 업로드 URL 생성 요청 DTO
 */

import { IsString, IsNumber, IsIn, MaxLength, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVideoUploadUrlDto {
  @ApiProperty({
    description: "원본 파일명",
    example: "my-video.mp4",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: "MIME 타입",
    example: "video/mp4",
    enum: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/mpeg",
      "video/3gpp",
      "video/x-ms-wmv",
      "video/ogg",
      "video/x-flv",
    ],
  })
  @IsString()
  @IsIn(
    [
      "video/mp4", // .mp4
      "video/webm", // .webm
      "video/quicktime", // .mov
      "video/x-msvideo", // .avi
      "video/x-matroska", // .mkv
      "video/mpeg", // .mpeg, .mpg
      "video/3gpp", // .3gp
      "video/x-ms-wmv", // .wmv
      "video/ogg", // .ogv
      "video/x-flv", // .flv
    ],
    {
      message:
        "지원하지 않는 비디오 형식입니다. (MP4, WebM, MOV, AVI, MKV, MPEG, 3GP, WMV, OGV, FLV 지원)",
    },
  )
  mimeType: string;

  @ApiProperty({
    description: "파일 크기 (bytes, 최대 100MB)",
    example: 52428800, // 50MB
    minimum: 1,
    maximum: 104857600, // 100MB
  })
  @IsNumber()
  @Min(1)
  @Max(104857600, {
    message: "파일 크기는 100MB를 초과할 수 없습니다.",
  })
  fileSize: number;
}
