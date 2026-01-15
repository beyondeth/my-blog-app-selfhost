import { IsString, IsNotEmpty } from "class-validator";

/**
 * API Key 검증 DTO (MCP Proxy → Backend)
 */
export class ValidateMcpApiKeyDto {
  /**
   * API Key (blog_sk_{hint}_{secret})
   */
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
