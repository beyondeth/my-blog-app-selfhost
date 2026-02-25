import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

/**
 * MCP API Key 원문 암호화/복호화 서비스
 *
 * 환경변수:
 * - MCP_API_KEY_ENCRYPTION_KEY: Base64 32바이트 키 (권장)
 * - IP_ENCRYPTION_KEY: fallback (MCP 키 미설정 시)
 */
@Injectable()
export class McpApiKeySecretService {
  private readonly logger = new Logger(McpApiKeySecretService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32;
  private readonly ivLength = 16;

  private readonly encryptionKey: Buffer;

  constructor() {
    const mcpKey = process.env.MCP_API_KEY_ENCRYPTION_KEY;
    const fallbackKey = process.env.IP_ENCRYPTION_KEY;
    const keySource = mcpKey || fallbackKey;
    const isDevelopment =
      (process.env.NODE_ENV ?? "").toLowerCase() === "development";

    if (!keySource) {
      if (!isDevelopment) {
        throw new Error(
          "MCP_API_KEY_ENCRYPTION_KEY (or IP_ENCRYPTION_KEY) must be configured outside development",
        );
      }

      this.logger.warn(
        "⚠️ MCP_API_KEY_ENCRYPTION_KEY not set. Using development key. DO NOT use in production!",
      );
      this.encryptionKey = crypto.scryptSync(
        "mcp-api-key-dev-secret",
        "mcp-api-key-dev-salt",
        this.keyLength,
      );
      return;
    }

    this.encryptionKey = Buffer.from(keySource, "base64");
    if (this.encryptionKey.length !== this.keyLength) {
      throw new Error(
        `MCP_API_KEY_ENCRYPTION_KEY must be ${this.keyLength} bytes (Base64-encoded)`,
      );
    }
  }

  encrypt(apiKey: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(apiKey, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(encryptedApiKey: string): string {
    const parts = encryptedApiKey.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted API key payload");
    }

    const [ivBase64, authTagBase64, cipherTextBase64] = parts;
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const cipherText = Buffer.from(cipherTextBase64, "base64");

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]).toString("utf8");
  }
}
