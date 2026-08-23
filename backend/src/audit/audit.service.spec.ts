import { AuditService } from "./audit.service";

describe("AuditService", () => {
  it("projects tenant audit readers without sensitive user fields", async () => {
    const auditLogRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: "audit-1",
            action: "admin_access_denied",
            entityType: "security",
            entityId: null,
            previousData: null,
            newData: null,
            metadata: { route: "/admin" },
            organizationId: "organization-1",
            requestId: "request-1",
            createdAt: new Date("2026-08-16T00:00:00.000Z"),
            performedBy: {
              id: "user-1",
              username: "admin",
              password: undefined,
              email: "admin@example.com",
            },
          },
        ],
        1,
      ]),
    };
    const requestContextService = { get: jest.fn().mockReturnValue({}) };
    const service = new AuditService(
      auditLogRepository as any,
      requestContextService as any,
    );

    const result = await service.findOrganizationLogs({
      organizationId: "organization-1",
      requestId: "request-1",
    });

    expect(result.data[0].performedBy).toEqual({
      id: "user-1",
      username: "admin",
    });
    expect(result.data[0]).not.toHaveProperty("ipAddress");
    expect(result.data[0]).not.toHaveProperty("performedBy.password");
  });
});
