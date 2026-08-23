import { UnauthorizedException } from "@nestjs/common";
import { CsrfGuard } from "./csrf.guard";

const contextFor = (request: any) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe("CsrfGuard", () => {
  it("accepts a matching session token for a cookie mutation", () => {
    const request: any = {
      method: "POST",
      session: { csrfToken: "csrf-token" },
      headers: { "x-csrf-token": "csrf-token" },
      cookies: { access_token: "access-token" },
      get: () => "blog.example.com",
    };

    expect(new CsrfGuard().canActivate(contextFor(request))).toBe(true);
  });

  it("skips CSRF checks for bearer requests", () => {
    const request = {
      method: "POST",
      headers: { authorization: "Bearer access-token" },
    };

    expect(new CsrfGuard().canActivate(contextFor(request))).toBe(true);
  });

  it("rejects a missing token", () => {
    const request = {
      method: "POST",
      session: { csrfToken: "csrf-token" },
      headers: {},
      cookies: { access_token: "access-token" },
    };

    expect(() => new CsrfGuard().canActivate(contextFor(request))).toThrow(
      UnauthorizedException,
    );
  });
});
