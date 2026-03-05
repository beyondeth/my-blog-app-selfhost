import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsNumber } from "class-validator";

export class UpdatePostVisibilityDto {
  @ApiProperty({
    description: "포스트 공개 범위",
    enum: ["public", "private"],
    example: "private",
  })
  @IsIn(["public", "private"])
  visibility: "public" | "private";

  @ApiProperty({
    description: "낙관적 락 버전",
    required: false,
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  version?: number;
}
