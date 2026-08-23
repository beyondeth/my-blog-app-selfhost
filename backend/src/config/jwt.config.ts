import { registerAs } from "@nestjs/config";
import { JwtModuleOptions, type JwtSignOptions } from "@nestjs/jwt";

export function parseJwtExpiresIn(value: string): JwtSignOptions["expiresIn"] {
  const normalized = value.trim();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (!/^\d+(?:\.\d+)?(?:ms|s|m|h|d|w|y)$/i.test(normalized)) {
    throw new Error(
      "JWT expiration must be a number of seconds or a duration such as 15m, 2h, or 7d",
    );
  }

  return normalized as JwtSignOptions["expiresIn"];
}

export default registerAs("jwt", (): JwtModuleOptions => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be defined in environment variables");
  }

  const issuer = process.env.JWT_ISSUER || "aigory.com";
  const audience = process.env.JWT_AUDIENCE || "aigory.com::api";

  return {
    secret: process.env.JWT_SECRET,
    signOptions: {
      // Keep the module default aligned with AuthService. JWT_EXPIRES_IN was
      // the legacy variable and could silently restore a one-day access token.
      expiresIn: parseJwtExpiresIn(process.env.JWT_ACCESS_EXPIRES_IN || "15m"),
      issuer,
      audience,
    },
    verifyOptions: {
      issuer,
      audience,
    },
  };
});
