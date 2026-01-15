import { IsDateString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 성인 인증 요청 DTO
 *
 * @description 생년월일을 입력받아 18세 이상인지 확인
 */
export class VerifyAdultDto {
  @ApiProperty({
    description: "생년월일 (YYYY-MM-DD 형식)",
    example: "1990-01-15",
  })
  @IsNotEmpty({ message: "생년월일을 입력해주세요." })
  @IsDateString({}, { message: "올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)" })
  birthdate: string;
}

/**
 * 성인 인증 응답 DTO
 */
export class VerifyAdultResponseDto {
  @ApiProperty({
    description: "성인 인증 성공 여부",
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: "성인 인증 완료 시각 (인증 성공 시)",
    example: "2024-01-15T09:30:00.000Z",
    required: false,
  })
  verifiedAt?: string;

  @ApiProperty({
    description: "메시지",
    example: "성인 인증이 완료되었습니다.",
  })
  message: string;
}
