import { registerAs } from "@nestjs/config";
import { JwtModuleOptions } from "@nestjs/jwt";

export default registerAs("jwt", (): JwtModuleOptions => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be defined in environment variables");
  }

  const issuer = process.env.JWT_ISSUER || "codebase.blog";
  const audience = process.env.JWT_AUDIENCE || "codebase.blog::api";

  return {
    secret: process.env.JWT_SECRET,
    signOptions: {
      expiresIn: process.env.JWT_EXPIRES_IN,
      issuer,
      audience,
    },
    verifyOptions: {
      issuer,
      audience,
    },
  };
});
