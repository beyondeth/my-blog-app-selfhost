import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendCodeDto {
  @ApiProperty({
    description: "인증 코드를 받을 이메일 주소",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "유효한 이메일 주소를 입력해주세요." })
  @IsNotEmpty({ message: "이메일을 입력해주세요." })
  email: string;
}
