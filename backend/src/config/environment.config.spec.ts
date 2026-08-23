import {
  isPlaceholderValue,
  validateProductionEnvironment,
} from "./environment.config";

describe("production environment validation", () => {
  const validEnvironment = (): NodeJS.ProcessEnv => ({
    NODE_ENV: "production",
    JWT_SECRET: "jwt-secret-with-at-least-32-characters",
    JWT_REFRESH_SECRET: "refresh-secret-with-at-least-32-characters",
    SESSION_SECRET: "session-secret-with-at-least-32-characters",
    MCP_SHARED_SECRET: "mcp-shared-secret-with-at-least-16-characters",
    UPLOAD_INTENT_SECRET: "upload-intent-secret-with-at-least-32-characters",
    REDIS_PASSWORD: "redis-password-with-enough-entropy",
    EMAIL_VERIFICATION_HASH_SECRET:
      "email-verification-secret-with-at-least-32-characters",
    IP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    IP_ENCRYPTION_SALT: "ip-encryption-salt-with-enough-entropy",
    PAYMENTS_ENABLED: "false",
    MOCK_PAYMENT_ENABLED: "false",
    FRONTEND_URL: "https://blog.example.com",
    PUBLIC_BACKEND_URL: "https://api.example.com",
    MCP_BASE_URL: "https://mcp.example.com",
    CORS_ALLOWED_ORIGINS: "https://blog.example.com",
    EMAIL_MODE: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "smtp-password",
    OPERATOR_NAME: "Example Operator",
    OPERATOR_CONTACT_EMAIL: "legal@example.com",
    LEGAL_DOCUMENT_VERSION: "20260823-v1.0",
    LEGAL_TERMS_URL: "https://blog.example.com/legal/terms",
    LEGAL_PRIVACY_URL: "https://blog.example.com/legal/privacy",
    DB_URL: "postgres://app:password@db.example.com:5432/app",
  });

  it("accepts a complete email-only production configuration", () => {
    expect(() =>
      validateProductionEnvironment(validEnvironment()),
    ).not.toThrow();
  });

  it("does not require unused OAuth providers", () => {
    const environment = validEnvironment();

    expect(() => validateProductionEnvironment(environment)).not.toThrow();
  });

  it("rejects weak or missing production secrets", () => {
    const environment = validEnvironment();
    delete environment.JWT_SECRET;
    environment.SESSION_SECRET = "short";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /JWT_SECRET|SESSION_SECRET/,
    );
  });

  it("requires a dedicated, valid IP encryption key", () => {
    const environment = validEnvironment();
    environment.IP_ENCRYPTION_KEY = "not-32-bytes";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /IP_ENCRYPTION_KEY/,
    );
  });

  it("requires the shared Redis session store in production", () => {
    const environment = validEnvironment();
    environment.SESSION_STORE = "memory";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /SESSION_STORE must be redis/,
    );
  });

  it("rejects blanket proxy trust in production", () => {
    const environment = validEnvironment();
    environment.TRUST_PROXY_CIDRS = "0.0.0.0/0";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /TRUST_PROXY_CIDRS/,
    );
  });

  it("rejects console email delivery in production", () => {
    const environment = validEnvironment();
    environment.EMAIL_MODE = "console";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /EMAIL_MODE/,
    );
  });

  it("rejects payment or mock-payment activation in production", () => {
    const environment = validEnvironment();
    environment.PAYMENTS_ENABLED = "true";
    environment.MOCK_PAYMENT_ENABLED = "true";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /PAYMENTS_ENABLED|MOCK_PAYMENT_ENABLED/,
    );
  });

  it("requires legal operator metadata in production", () => {
    const environment = validEnvironment();
    delete environment.OPERATOR_NAME;
    delete environment.LEGAL_TERMS_URL;

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /OPERATOR_NAME|LEGAL_TERMS_URL/,
    );
  });

  it("rejects localhost and http public legal/application URLs in production", () => {
    const environment = validEnvironment();
    environment.FRONTEND_URL = "http://localhost:3001";
    environment.PUBLIC_BACKEND_URL = "http://localhost:3000";
    environment.MCP_BASE_URL = "http://localhost:3002";
    environment.LEGAL_TERMS_URL = "http://localhost:3001/legal/terms";
    environment.LEGAL_PRIVACY_URL = "http://localhost:3001/legal/privacy";
    environment.CORS_ALLOWED_ORIGINS = "http://localhost:3001";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /FRONTEND_URL|PUBLIC_BACKEND_URL|MCP_BASE_URL|LEGAL_TERMS_URL|LEGAL_PRIVACY_URL|CORS_ALLOWED_ORIGINS/,
    );
  });

  it("requires all settings when an OAuth provider is partially configured", () => {
    const environment = validEnvironment();
    environment.GOOGLE_CLIENT_ID = "google-client-id";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /GOOGLE_CLIENT_SECRET|GOOGLE_CALLBACK_URL/,
    );
  });

  it("rejects placeholder OAuth credentials instead of silently disabling the provider", () => {
    const environment = validEnvironment();
    environment.GITHUB_CLIENT_ID = "your-github-client-id";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|GITHUB_CALLBACK_URL/,
    );
  });

  it("requires an HTTPS non-loopback OAuth callback in production", () => {
    const environment = validEnvironment();
    environment.GITHUB_CLIENT_ID = "github-client-id";
    environment.GITHUB_CLIENT_SECRET = "github-client-secret";
    environment.GITHUB_CALLBACK_URL =
      "http://localhost:3000/api/v1/auth/github/callback";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /GITHUB_CALLBACK_URL/,
    );
  });

  it("rejects non-local databases without TLS", () => {
    const environment = validEnvironment();
    delete environment.DB_URL;
    environment.DB_HOST = "db.example.com";
    environment.DB_USERNAME = "app";
    environment.DB_PASSWORD = "password";
    environment.DB_DATABASE = "app";

    expect(() => validateProductionEnvironment(environment)).toThrow(
      /DB_SSL_ENABLED/,
    );
  });

  it("recognizes common placeholder values", () => {
    expect(isPlaceholderValue("replace-with-a-secret")).toBe(true);
    expect(isPlaceholderValue("real-secret-value")).toBe(false);
  });
});
