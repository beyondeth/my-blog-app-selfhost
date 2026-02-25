import { McpApiKeySecretService } from "./mcp-api-key-secret.service";

describe("McpApiKeySecretService", () => {
  const originalMcpKey = process.env.MCP_API_KEY_ENCRYPTION_KEY;
  const originalIpKey = process.env.IP_ENCRYPTION_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.MCP_API_KEY_ENCRYPTION_KEY = originalMcpKey;
    process.env.IP_ENCRYPTION_KEY = originalIpKey;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should encrypt and decrypt API key with configured key", () => {
    process.env.MCP_API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
      "base64",
    );

    const service = new McpApiKeySecretService();
    const original = "blog_sk_a1b2c3d4_secretvalue";
    const encrypted = service.encrypt(original);

    expect(encrypted).not.toEqual(original);
    expect(service.decrypt(encrypted)).toEqual(original);
  });

  it("should throw when encryption key length is invalid", () => {
    process.env.MCP_API_KEY_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString(
      "base64",
    );

    expect(() => new McpApiKeySecretService()).toThrow(
      "MCP_API_KEY_ENCRYPTION_KEY must be 32 bytes (Base64-encoded)",
    );
  });

  it("should allow development fallback key only in development", () => {
    delete process.env.MCP_API_KEY_ENCRYPTION_KEY;
    delete process.env.IP_ENCRYPTION_KEY;
    process.env.NODE_ENV = "development";

    const service = new McpApiKeySecretService();
    const original = "blog_sk_dev_fallback_secret";
    const encrypted = service.encrypt(original);

    expect(service.decrypt(encrypted)).toEqual(original);
  });

  it("should fail closed when encryption key is missing outside development", () => {
    delete process.env.MCP_API_KEY_ENCRYPTION_KEY;
    delete process.env.IP_ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";

    expect(() => new McpApiKeySecretService()).toThrow(
      "MCP_API_KEY_ENCRYPTION_KEY (or IP_ENCRYPTION_KEY) must be configured outside development",
    );
  });
});
