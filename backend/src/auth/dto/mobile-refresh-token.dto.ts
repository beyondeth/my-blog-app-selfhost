import { IsString } from "class-validator";

export class MobileRefreshTokenDto {
  @IsString()
  refreshToken: string;
}
