import { IsEmail, IsString } from "class-validator";

export class CheckEmailDto {
  @IsEmail()
  @IsString()
  email: string;
}
