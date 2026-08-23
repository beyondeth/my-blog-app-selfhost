import { AdminAuditController } from "./admin-audit.controller";

describe("AdminAuditController", () => {
  it("always applies the authenticated organization scope", async () => {
    const auditService = {
      findOrganizationLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const controller = new AdminAuditController(auditService as any);

    await controller.listLogs(
      {
        entityType: "security",
        requestId: "request-123",
        page: 2,
        limit: 25,
      } as any,
      "organization-123",
    );

    expect(auditService.findOrganizationLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "organization-123",
        entityType: "security",
        requestId: "request-123",
      }),
      2,
      25,
    );
  });
});
