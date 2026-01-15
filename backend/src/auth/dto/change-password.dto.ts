import { IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 비밀번호 변경 DTO
 * 로그인한 사용자가 현재 비밀번호를 입력하고 새 비밀번호로 변경
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password",
    minLength: 8,
    example: "currentPassword123",
  })
  @IsString()
  @MinLength(8, { message: "현재 비밀번호는 최소 8자 이상이어야 합니다" })
  currentPassword: string;

  @ApiProperty({
    description: "New password",
    minLength: 8,
    example: "NewPassword123",
  })
  @IsString()
  @MinLength(8, { message: "새 비밀번호는 최소 8자 이상이어야 합니다" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "비밀번호는 최소 하나의 소문자, 하나의 대문자, 그리고 하나의 숫자를 포함해야 합니다",
  })
  @Matches(/^[^"'\\<>`\s]*$/, {
    message:
      "비밀번호에 사용할 수 없는 문자가 포함되어 있습니다: \" ' \\ < > ` 공백",
  })
  newPassword: string;
}
