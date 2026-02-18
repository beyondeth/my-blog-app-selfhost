import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class MobileOAuthExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @IsOptional()
  @IsString()
  @IsIn(["google", "github", "kakao"])
  provider?: "google" | "github" | "kakao";
}

