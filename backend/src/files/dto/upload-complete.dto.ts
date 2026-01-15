import { IsString, IsUrl, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UploadCompleteDto {
  @ApiProperty({
    description: "S3 파일 키",
    example: "uploads/2024/12/image-uuid.jpg",
  })
  @IsString()
  fileKey: string;

  @ApiProperty({
    description: "파일 URL",
    example:
      "https://bucket.s3.region.amazonaws.com/uploads/2024/12/image-uuid.jpg",
  })
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: "원본 파일명", example: "image.jpg" })
  @IsString()
  fileName: string;

  @ApiProperty({ description: "MIME 타입", example: "image/jpeg" })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: "파일 크기 (bytes)", example: 1024000 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ description: "파일 타입", example: "image", required: false })
  @IsOptional()
  @IsString()
  fileType?: string;
}
