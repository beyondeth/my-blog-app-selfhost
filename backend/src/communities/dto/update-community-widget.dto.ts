import { PartialType } from "@nestjs/swagger";
import { CreateCommunityWidgetDto } from "./create-community-widget.dto";
import { IsOptional } from "class-validator";

export class UpdateCommunityWidgetDto extends PartialType(
  CreateCommunityWidgetDto,
) {
  /**
   * 타입은 수정할 수 없도록 막는다.
   */
  @IsOptional()
  readonly type?: never;
}
