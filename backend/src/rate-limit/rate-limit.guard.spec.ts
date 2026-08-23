import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitGuard } from "./rate-limit.guard";
import { RateLimitService } from "./rate-limit.service";

describe("RateLimitGuard", () => {
  const handler = jest.fn();
  class TestController {}

  function context(
    request: Record<string, any>,
    response: Record<string, any>,
  ) {
    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any;
  }

  it("applies the default policy when an endpoint has no decorator", async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) };
    const service = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        limit: 120,
        remaining: 119,
        resetAfter: 60,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      service as unknown as RateLimitService,
    );

    await expect(
      guard.canActivate(context({ headers: {}, ip: "203.0.113.10" }, response)),
    ).resolves.toBe(true);
    expect(service.consume).toHaveBeenCalledWith("default", "ip:203.0.113.10");
  });

  it("uses endpoint policy metadata and authenticated user identity", async () => {
    const reflector = {
      get: jest.fn().mockReturnValue("community-comment-write"),
    };
    const service = {
      consume: jest.fn().mockResolvedValue({ allowed: true, limit: 5 }),
    };
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      service as unknown as RateLimitService,
    );

    await guard.canActivate(
      context(
        { headers: {}, ip: "203.0.113.10", user: { id: "user-1" } },
        { setHeader: jest.fn() },
      ),
    );
    expect(service.consume).toHaveBeenCalledWith(
      "community-comment-write",
      "user:user-1",
    );
  });

  it("returns 429 and Retry-After when the policy rejects a request", async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) };
    const service = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        limit: 120,
        retryAfter: 30,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      service as unknown as RateLimitService,
    );

    await expect(
      guard.canActivate(context({ headers: {}, ip: "203.0.113.10" }, response)),
    ).rejects.toBeInstanceOf(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", 30);
  });
});
