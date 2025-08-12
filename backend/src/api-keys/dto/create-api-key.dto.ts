import { IsString, IsOptional, IsUUID, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  blogId: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;
}