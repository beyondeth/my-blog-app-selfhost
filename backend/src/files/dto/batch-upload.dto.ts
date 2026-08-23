import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class BatchFileUploadDto {
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
  @Max(10485760)
  fileSize: number;

  @ApiProperty({
    description: "파일 타입",
    example: "image",
    enum: ["image", "document", "video", "general"],
  })
  @IsOptional()
  @IsIn(["image", "document", "video", "general"])
  fileType?: string = "image";
}

export class CreateBatchUploadUrlDto {
  @ApiProperty({
    description: "업로드할 파일들의 정보",
    type: [BatchFileUploadDto],
    maxItems: 5,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchFileUploadDto)
  @ArrayMaxSize(5, {
    message: "한 번에 최대 5개의 파일만 업로드할 수 있습니다.",
  })
  files: BatchFileUploadDto[];

  @ApiProperty({
    description: "업로드 컨텍스트 (선택사항)",
    example: "post-creation",
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;
}

export class BatchUploadCompleteDto {
  @ApiProperty({
    description: "배치 업로드 URL 발급 시 서버가 반환한 서명된 배치 intent",
  })
  @IsString()
  @MaxLength(2048)
  batchId: string;

  @ApiProperty({ description: "업로드된 파일들의 S3 키", type: [String] })
  @IsArray()
  @IsString({ each: true })
  fileKeys: string[];

  @ApiProperty({
    description: "업로드 컨텍스트 (선택사항)",
    example: "post-creation",
    required: false,
  })
  @IsOptional()
  @IsString()
  context?: string;
}
