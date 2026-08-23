import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  assertInternalMcpSecret,
  InternalMcpGuard,
} from "./internal-mcp.guard";

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe("InternalMcpGuard", () => {
  it("requires the internal secret in production", () => {
    expect(() =>
      assertInternalMcpSecret(
        { headers: {} },
        config({ NODE_ENV: "production" }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it("accepts a matching secret and rejects a near miss", () => {
    const service = config({
      NODE_ENV: "production",
      MCP_SHARED_SECRET: "a-secret-with-enough-entropy",
    });

    expect(() =>
      assertInternalMcpSecret(
        { headers: { "x-internal-secret": "a-secret-with-enough-entropy" } },
        service,
      ),
    ).not.toThrow();

    expect(() =>
      assertInternalMcpSecret(
        { headers: { "x-internal-secret": "a-secret-with-enough-entropY" } },
        service,
      ),
    ).toThrow(UnauthorizedException);
  });

  it("keeps local development usable when no secret is configured", () => {
    const guard = new InternalMcpGuard(config({ NODE_ENV: "development" }));
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });
});
