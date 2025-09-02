import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsDate } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Account verification timestamp',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDate()
  accountVerifiedAt?: Date;
} 