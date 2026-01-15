import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUploadUrlDto {
  @ApiProperty({ description: "원본 파일명", example: "image.jpg" })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: "MIME 타입", example: "image/jpeg" })
  @IsString()
  mimeType: string;

  @ApiProperty({
    description: "파일 크기 (bytes)",
    example: 1024000,
    minimum: 1,
    maximum: 10485760, // 10MB
  })
  @IsNumber()
  @Min(1)
  @Max(10485760) // 10MB 제한
  fileSize: number;

  @ApiProperty({
    description: "파일 타입",
    example: "image",
    enum: ["image", "document", "video", "general"],
  })
  @IsOptional()
  @IsIn(["image", "document", "video", "general"])
  fileType?: string = "general";
}
