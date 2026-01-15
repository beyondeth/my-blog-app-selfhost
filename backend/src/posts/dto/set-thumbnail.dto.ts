import { IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetThumbnailDto {
  @ApiProperty({
    description: "썸네일로 설정할 파일 ID (null이면 썸네일 제거)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  thumbnailFileId?: string | null;
}
