import { IsString, IsUUID, IsNotEmpty, MaxLength } from "class-validator";

/**
 * API Key 생성 DTO
 */
export class CreateMcpApiKeyDto {
  /**
   * 블로그 ID
   */
  @IsUUID()
  @IsNotEmpty()
  blogId: string;

  /**
   * API Key 이름 (예: "My MCP Key", "Production Key")
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
