import { IsString, IsUUID, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @IsString()
  @IsOptional()
  tempId?: string;
}