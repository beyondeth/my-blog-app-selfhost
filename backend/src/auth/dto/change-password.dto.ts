import { IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Change password DTO
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password",
    minLength: 8,
    example: "currentPassword123",
  })
  @IsString()
  @MinLength(8, { message: "Current password must be at least 8 characters long." })
  currentPassword: string;

  @ApiProperty({
    description: "New password",
    minLength: 8,
    example: "NewPassword123",
  })
  @IsString()
  @MinLength(8, { message: "New password must be at least 8 characters long." })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Password must include at least one lowercase letter, one uppercase letter, and one number.",
  })
  @Matches(/^[^"'\\<>`\s]*$/, {
    message:
      "Password contains unsupported characters: \" ' \\ < > ` or whitespace.",
  })
  newPassword: string;
}
