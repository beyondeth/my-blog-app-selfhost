import {
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ReorderItemDto {
  @IsUUID()
  id: string;
}

export class ReorderCommunityWidgetsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
