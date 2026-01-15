import { Expose } from "class-transformer";

export class SocialLinkResponseDto {
  @Expose()
  platform: string;

  @Expose()
  url: string;
}
