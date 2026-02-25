import {
  decodeMobileOAuthState,
  encodeMobileOAuthState,
  sanitizeMobileRedirectUri,
} from "./oauth-mobile-redirect.util";

describe("oauth-mobile-redirect util", () => {
  it("accepts unsigned state when secret is not configured", () => {
    const encoded = encodeMobileOAuthState("codebase://auth/callback");
    const decoded = decodeMobileOAuthState(encoded);

    expect(decoded?.mobileRedirectUri).toBe("codebase://auth/callback");
  });

  it("rejects unsigned state when secret is configured", () => {
    const encoded = encodeMobileOAuthState("codebase://auth/callback");
    const decoded = decodeMobileOAuthState(encoded, "jwt-secret");

    expect(decoded).toBeNull();
  });

  it("encodes and decodes signed state", () => {
    const secret = "jwt-secret";
    const encoded = encodeMobileOAuthState("codebase://auth/callback", secret);
    const decoded = decodeMobileOAuthState(encoded, secret);

    expect(decoded?.mobileRedirectUri).toBe("codebase://auth/callback");
    expect(decoded?.rid).toBeTruthy();
  });

  it("rejects tampered signature", () => {
    const secret = "jwt-secret";
    const encoded = encodeMobileOAuthState("codebase://auth/callback", secret);
    const tampered = `${encoded}x`;
    const decoded = decodeMobileOAuthState(tampered, secret);

    expect(decoded).toBeNull();
  });

  it("sanitizes unsupported redirect scheme", () => {
    const allowed = new Set(["codebase"]);
    const result = sanitizeMobileRedirectUri(
      "https://www.codebase.blog/auth/callback",
      allowed,
    );
    expect(result).toBeNull();
  });
});
