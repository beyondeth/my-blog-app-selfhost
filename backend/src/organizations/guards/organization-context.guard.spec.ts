import { ExecutionContext } from "@nestjs/common";
import { OrganizationContextGuard } from "./organization-context.guard";

describe("OrganizationContextGuard", () => {
  const createContext = (request: any): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it("resolves the requested organization through membership", async () => {
    const organizationId = "0198f27f-7b25-7b3f-8ae6-2f7642c24ab7";
    const organizationsService = {
      resolveContext: jest.fn().mockResolvedValue({
        organizationId,
        role: "member",
        isPersonal: false,
      }),
    };
    const requestContextService = { update: jest.fn() };
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
    };
    const request: any = {
      user: { id: "user-1" },
      headers: {
        "x-organization-id": organizationId,
      },
    };
    const guard = new OrganizationContextGuard(
      reflector as any,
      organizationsService as any,
      requestContextService as any,
    );

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(organizationsService.resolveContext).toHaveBeenCalledWith(
      "user-1",
      organizationId,
    );
    expect(request.organizationContext).toEqual(
      expect.objectContaining({ organizationId: expect.any(String) }),
    );
    expect(requestContextService.update).toHaveBeenCalledWith({
      organizationId,
    });
  });

  it("rejects a malformed organization header before querying membership", async () => {
    const organizationsService = {
      resolveContext: jest.fn(),
    };
    const requestContextService = { update: jest.fn() };
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
    };
    const request: any = {
      user: { id: "user-1" },
      headers: { "x-organization-id": "not-a-uuid" },
    };
    const guard = new OrganizationContextGuard(
      reflector as any,
      organizationsService as any,
      requestContextService as any,
    );

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      "X-Organization-Id must be a UUID",
    );
    expect(organizationsService.resolveContext).not.toHaveBeenCalled();
  });

  it("does not resolve context for an unscoped route", async () => {
    const organizationsService = {
      resolveContext: jest.fn(),
    };
    const requestContextService = { update: jest.fn() };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    const guard = new OrganizationContextGuard(
      reflector as any,
      organizationsService as any,
      requestContextService as any,
    );

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).resolves.toBe(true);
    expect(organizationsService.resolveContext).not.toHaveBeenCalled();
  });
});
