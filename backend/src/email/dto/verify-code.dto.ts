import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com'
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  email: string;

  @ApiProperty({
    description: '6자리 인증 코드',
    example: '123456'
  })
  @IsNotEmpty({ message: '인증 코드를 입력해주세요.' })
  @Length(6, 6, { message: '인증 코드는 6자리여야 합니다.' })
  code: string;
}