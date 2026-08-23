import { consumeOAuthState, issueOAuthState } from "./oauth-state.util";

describe("oauth state util", () => {
  const request = () => ({ session: {} as Record<string, unknown> });

  it("issues and consumes a provider-bound state exactly once", () => {
    const req = request();
    const { state } = issueOAuthState(req, "github");

    expect(consumeOAuthState(req, "github", state)).toMatchObject({
      provider: "github",
    });
    expect(() => consumeOAuthState(req, "github", state)).toThrow(
      /Invalid or expired OAuth state/,
    );
  });

  it("rejects a state reused for another provider", () => {
    const req = request();
    const { state } = issueOAuthState(req, "google");

    expect(() => consumeOAuthState(req, "kakao", state)).toThrow(
      /provider mismatch/,
    );
  });
});
