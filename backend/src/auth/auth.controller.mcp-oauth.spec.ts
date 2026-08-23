import * as crypto from "crypto";
import { createMcpOAuthGrant } from "./auth.controller";

describe("MCP OAuth Backend grant", () => {
  it("signs all bindings with an exact 60-second lifetime", () => {
    const secret = "test-mcp-shared-secret-with-enough-entropy";
    const now = 1_800_000_000;
    const grant = createMcpOAuthGrant(
      {
        iss: "https://api.example.com/api/v1/auth/oauth/mcp",
        aud: "https://mcp.example.com",
        sub: "11111111-1111-4111-8111-111111111111",
        state: "state-value",
        callback: "https://mcp.example.com/oauth/callback",
      },
      secret,
      now,
      "22222222-2222-4222-8222-222222222222",
    );
    const [header, payload, signature] = grant.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    expect(signature).toBe(expectedSignature);
    expect(claims).toMatchObject({
      iss: "https://api.example.com/api/v1/auth/oauth/mcp",
      aud: "https://mcp.example.com",
      sub: "11111111-1111-4111-8111-111111111111",
      state: "state-value",
      callback: "https://mcp.example.com/oauth/callback",
      jti: "22222222-2222-4222-8222-222222222222",
      iat: now,
      exp: now + 60,
    });
  });
});
