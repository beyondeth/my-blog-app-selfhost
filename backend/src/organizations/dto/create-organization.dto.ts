import { IsString, Length, Matches } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 150)
  name: string;

  @IsString()
  @Length(3, 160)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "slug은 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
  })
  slug: string;
}
