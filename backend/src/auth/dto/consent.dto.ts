import { IsBoolean, IsOptional, ValidateIf } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * OAuth 로그인 후 약관 동의 DTO
 * 소셜 로그인 사용자가 최초 로그인 시 필수 약관 동의를 받기 위한 DTO
 */
export class ConsentDto {
  @ApiProperty({
    description: "만 14세 이상 확인 (필수)",
    example: true,
  })
  @IsBoolean()
  @ValidateIf((o) => o.isOver14 === false)
  isOver14: boolean;

  @ApiProperty({
    description: "이용약관 동의 (필수)",
    example: true,
  })
  @IsBoolean()
  @ValidateIf((o) => o.termsAccepted === false)
  termsAccepted: boolean;

  @ApiProperty({
    description: "개인정보 처리방침 동의 (필수)",
    example: true,
  })
  @IsBoolean()
  @ValidateIf((o) => o.privacyAccepted === false)
  privacyAccepted: boolean;

  @ApiProperty({
    description: "마케팅 정보 수신 동의 (선택)",
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  marketingOptIn?: boolean;

  @ApiProperty({
    description: "뉴스레터 수신 동의 (선택)",
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  newsletterOptIn?: boolean;
}
