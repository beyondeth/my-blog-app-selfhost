import {
  IsArray,
  IsString,
  IsNumber,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class ImageOrderDto {
  @ApiProperty({
    description: "파일 ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  fileId: string;

  @ApiProperty({
    description: "이미지 순서 (0부터 시작)",
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  order: number;
}

export class UpdateImageOrderDto {
  @ApiProperty({
    description: "이미지 순서 정보",
    type: [ImageOrderDto],
    example: [
      { fileId: "123e4567-e89b-12d3-a456-426614174000", order: 0 },
      { fileId: "123e4567-e89b-12d3-a456-426614174001", order: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderDto)
  imageOrder: ImageOrderDto[];
}
