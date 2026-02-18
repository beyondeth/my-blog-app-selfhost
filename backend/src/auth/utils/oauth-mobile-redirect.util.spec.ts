import {
  decodeMobileOAuthState,
  encodeMobileOAuthState,
  sanitizeMobileRedirectUri,
} from "./oauth-mobile-redirect.util";

describe("oauth-mobile-redirect util", () => {
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

