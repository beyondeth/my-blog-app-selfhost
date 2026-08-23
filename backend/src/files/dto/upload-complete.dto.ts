import { IsString, IsNumber, IsOptional, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UploadCompleteDto {
  @ApiProperty({
    description: "서버가 업로드 URL 발급 시 생성한 서명된 업로드 intent",
  })
  @IsString()
  @MaxLength(2048)
  tempId: string;

  @ApiProperty({
    description: "S3 파일 키",
    example: "uploads/2024/12/image-uuid.jpg",
  })
  @IsString()
  @MaxLength(1024)
  fileKey: string;

  @ApiProperty({
    description: "파일 URL",
    example:
      "https://bucket.s3.region.amazonaws.com/uploads/2024/12/image-uuid.jpg",
  })
  @IsString()
  @MaxLength(2048)
  fileUrl: string;

  @ApiProperty({ description: "원본 파일명", example: "image.jpg" })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: "MIME 타입", example: "image/jpeg" })
  @IsString()
  @MaxLength(255)
  mimeType: string;

  @ApiProperty({ description: "파일 크기 (bytes)", example: 1024000 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ description: "파일 타입", example: "image", required: false })
  @IsOptional()
  @IsString()
  fileType?: string;
}
