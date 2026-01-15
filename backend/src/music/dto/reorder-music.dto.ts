import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * 재생 순서 아이템
 */
class ReorderItem {
  @ApiProperty({
    description: "음악 ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: "새 순서",
    example: 0,
  })
  @IsNumber()
  @Min(0)
  order: number;
}

/**
 * 음악 재생 순서 변경 DTO
 * 드래그앤드롭으로 순서 변경 시 사용
 */
export class ReorderMusicDto {
  @ApiProperty({
    description: "순서 변경할 음악 목록",
    type: [ReorderItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
