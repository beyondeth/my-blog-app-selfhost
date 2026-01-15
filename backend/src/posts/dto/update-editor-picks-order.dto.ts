import { ArrayMaxSize, ArrayMinSize, IsArray, Matches } from "class-validator";

const uuidAnyVersionRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateEditorPicksOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @Matches(uuidAnyVersionRegex, {
    each: true,
    message: "each value in orderedIds must be a UUID",
  })
  orderedIds: string[];
}
