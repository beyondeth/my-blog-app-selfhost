import {
  resolveSessionStoreMode,
  resolveTrustedProxyAddresses,
} from "../common/session/session-config.util";

const PLACEHOLDER_VALUE_PATTERN =
  /^(?:dummy-|your-|replace-with|change-me|example(?:-|$)|local self-host operator$|operator@example\.com$)/i;

export function isProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.NODE_ENV === "production";
}

export function isPlaceholderValue(value: string | undefined): boolean {
  return !value || PLACEHOLDER_VALUE_PATTERN.test(value.trim());
}

export function isDefaultOAuthCallback(
  value: string | undefined,
  provider: string,
): boolean {
  return (
    value?.trim() ===
    `http://localhost:3000/api/v1/auth/${provider.toLowerCase()}/callback`
  );
}

function requireValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  errors: string[],
  options: { minLength?: number } = {},
): string | undefined {
  const value = environment[name]?.trim();

  if (isPlaceholderValue(value)) {
    errors.push(name);
    return undefined;
  }

  if (options.minLength && value.length < options.minLength) {
    errors.push(`${name} (at least ${options.minLength} characters)`);
  }

  return value;
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateUrl(
  environment: NodeJS.ProcessEnv,
  name: string,
  errors: string[],
  options: { requireHttps?: boolean; disallowLocalhost?: boolean } = {},
): void {
  const value = requireValue(environment, name, errors);
  if (value && !isHttpUrl(value)) {
    errors.push(`${name} (must be an http(s) URL)`);
    return;
  }

  if (!value) {
    return;
  }

  const url = new URL(value);
  if (options.requireHttps && url.protocol !== "https:") {
    errors.push(`${name} (must use https in production)`);
  }

  if (
    options.disallowLocalhost &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    errors.push(`${name} (must not use a loopback host in production)`);
  }
}

/**
 * Validate settings which must never fall back to development defaults.
 *
 * This intentionally runs only for NODE_ENV=production. The self-hosted
 * development workflow can continue using local defaults, while production
 * fails before accepting traffic if it would otherwise run with weak secrets,
 * console email delivery, or placeholder OAuth credentials.
 */
export function validateProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (!isProductionEnvironment(environment)) {
    return;
  }

  const errors: string[] = [];

  try {
    resolveSessionStoreMode(environment);
    resolveTrustedProxyAddresses(environment);
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Session configuration",
    );
  }

  requireValue(environment, "JWT_SECRET", errors, { minLength: 32 });
  requireValue(environment, "JWT_REFRESH_SECRET", errors, { minLength: 32 });
  requireValue(environment, "SESSION_SECRET", errors, { minLength: 32 });
  requireValue(environment, "MCP_SHARED_SECRET", errors, { minLength: 16 });
  requireValue(environment, "UPLOAD_INTENT_SECRET", errors, {
    minLength: 32,
  });
  requireValue(environment, "REDIS_PASSWORD", errors, { minLength: 16 });
  requireValue(environment, "EMAIL_VERIFICATION_HASH_SECRET", errors, {
    minLength: 32,
  });
  const ipEncryptionKey = requireValue(
    environment,
    "IP_ENCRYPTION_KEY",
    errors,
  );
  if (ipEncryptionKey) {
    try {
      if (Buffer.from(ipEncryptionKey, "base64").length !== 32) {
        errors.push("IP_ENCRYPTION_KEY (must decode to 32 bytes)");
      }
    } catch {
      errors.push("IP_ENCRYPTION_KEY (must be valid base64)");
    }
  }
  requireValue(environment, "IP_ENCRYPTION_SALT", errors, {
    minLength: 16,
  });

  if (environment.PAYMENTS_ENABLED === "true") {
    errors.push("PAYMENTS_ENABLED (must remain false in this release)");
  }
  if (environment.MOCK_PAYMENT_ENABLED === "true") {
    errors.push("MOCK_PAYMENT_ENABLED (must remain false in production)");
  }
  validateUrl(environment, "FRONTEND_URL", errors, {
    requireHttps: true,
    disallowLocalhost: true,
  });
  validateUrl(environment, "MCP_BASE_URL", errors, {
    requireHttps: true,
    disallowLocalhost: true,
  });

  const backendPublicUrl =
    environment.PUBLIC_BACKEND_URL || environment.BACKEND_PUBLIC_URL;
  if (!backendPublicUrl || !isHttpUrl(backendPublicUrl)) {
    errors.push("PUBLIC_BACKEND_URL (or BACKEND_PUBLIC_URL)");
  } else {
    const url = new URL(backendPublicUrl);
    if (url.protocol !== "https:") {
      errors.push("PUBLIC_BACKEND_URL (or BACKEND_PUBLIC_URL) must use https");
    }
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      errors.push(
        "PUBLIC_BACKEND_URL (or BACKEND_PUBLIC_URL) must not use a loopback host",
      );
    }
  }

  const corsOrigins = (
    environment.CORS_ALLOWED_ORIGINS ||
    environment.CORS_ORIGIN ||
    ""
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    errors.push("CORS_ALLOWED_ORIGINS");
  } else {
    for (const origin of corsOrigins) {
      if (
        origin === "null" ||
        origin.includes("*") ||
        !isHttpUrl(origin) ||
        !origin.startsWith("https://")
      ) {
        errors.push("CORS_ALLOWED_ORIGINS (exact http(s) origins only)");
        break;
      }
    }
  }

  const emailMode = (environment.EMAIL_MODE || "smtp").trim().toLowerCase();
  if (emailMode !== "smtp") {
    errors.push("EMAIL_MODE (must be smtp in production)");
  }

  const smtpHost = environment.SMTP_HOST || environment.EMAIL_HOST;
  const smtpUser = environment.SMTP_USER || environment.EMAIL_USER;
  const smtpPass = environment.SMTP_PASS || environment.EMAIL_PASS;
  if (isPlaceholderValue(smtpHost)) errors.push("SMTP_HOST");
  if (isPlaceholderValue(smtpUser)) errors.push("SMTP_USER");
  if (isPlaceholderValue(smtpPass)) errors.push("SMTP_PASS");

  requireValue(environment, "OPERATOR_NAME", errors);
  requireValue(environment, "OPERATOR_CONTACT_EMAIL", errors);
  requireValue(environment, "LEGAL_DOCUMENT_VERSION", errors);
  validateUrl(environment, "LEGAL_TERMS_URL", errors, {
    requireHttps: true,
    disallowLocalhost: true,
  });
  validateUrl(environment, "LEGAL_PRIVACY_URL", errors, {
    requireHttps: true,
    disallowLocalhost: true,
  });

  const configuredRequiredProviders = new Set(
    (environment.REQUIRED_OAUTH_PROVIDERS || "")
      .split(",")
      .map((provider) => provider.trim().toUpperCase())
      .filter(Boolean),
  );
  const oauthProviders = ["GOOGLE", "GITHUB", "KAKAO"];
  for (const provider of configuredRequiredProviders) {
    if (!oauthProviders.includes(provider)) {
      errors.push(
        `REQUIRED_OAUTH_PROVIDERS (unsupported provider: ${provider})`,
      );
    }
  }

  for (const provider of oauthProviders) {
    const hasAnySetting = [
      environment[`${provider}_CLIENT_ID`],
      environment[`${provider}_CLIENT_SECRET`],
      environment[`${provider}_CALLBACK_URL`],
    ].some(
      (value, index) =>
        Boolean(value?.trim()) &&
        !(index === 2 && isDefaultOAuthCallback(value, provider)),
    );
    const isRequired = configuredRequiredProviders.has(provider);

    if (hasAnySetting || isRequired) {
      requireValue(environment, `${provider}_CLIENT_ID`, errors);
      requireValue(environment, `${provider}_CLIENT_SECRET`, errors);
      validateUrl(environment, `${provider}_CALLBACK_URL`, errors, {
        requireHttps: true,
        disallowLocalhost: true,
      });
      if (
        isDefaultOAuthCallback(
          environment[`${provider}_CALLBACK_URL`],
          provider,
        )
      ) {
        errors.push(
          `${provider}_CALLBACK_URL (explicit production URL required)`,
        );
      }
    }
  }

  const dbUrl = environment.DB_URL || environment.DATABASE_URL;
  if (!dbUrl) {
    for (const name of [
      "DB_HOST",
      "DB_USERNAME",
      "DB_PASSWORD",
      "DB_DATABASE",
    ]) {
      requireValue(environment, name, errors);
    }

    const dbHost = environment.DB_HOST?.trim().toLowerCase();
    const isLocalDatabase = dbHost
      ? ["localhost", "127.0.0.1", "::1", "postgres", "pgbouncer"].includes(
          dbHost,
        )
      : false;
    if (!isLocalDatabase && environment.DB_SSL_ENABLED !== "true") {
      errors.push("DB_SSL_ENABLED=true for non-local production databases");
    }
  }

  if (environment.DB_SSL_REJECT_UNAUTHORIZED === "false") {
    errors.push("DB_SSL_REJECT_UNAUTHORIZED (cannot be false in production)");
  }

  if (errors.length > 0) {
    throw new Error(
      `Production environment validation failed: ${[...new Set(errors)].join(
        ", ",
      )}`,
    );
  }
}
