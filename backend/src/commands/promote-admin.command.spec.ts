import { Role } from "../common/enums/role.enum";
import { promoteExistingUser } from "./promote-admin.command";

describe("promoteExistingUser", () => {
  const createUser = (overrides: Record<string, unknown> = {}) =>
    ({
      id: "user-1",
      email: "owner@example.com",
      role: Role.USER,
      isDeleted: false,
      isActive: true,
      isEmailVerified: true,
      ...overrides,
    }) as any;

  it("promotes an existing verified active user", async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(createUser()),
      update: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      promoteExistingUser(usersService, "owner@example.com"),
    ).resolves.toBe("promoted");
    expect(usersService.update).toHaveBeenCalledWith("user-1", {
      role: Role.ADMIN,
    });
  });

  it("does not create or update when the email is not found", async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };

    await expect(
      promoteExistingUser(usersService, "missing@example.com"),
    ).rejects.toThrow("No active user found");
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it("is idempotent for an existing administrator", async () => {
    const usersService = {
      findByEmail: jest
        .fn()
        .mockResolvedValue(createUser({ role: Role.ADMIN })),
      update: jest.fn(),
    };

    await expect(
      promoteExistingUser(usersService, "owner@example.com"),
    ).resolves.toBe("already-admin");
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it("rejects inactive or unverified accounts", async () => {
    const inactiveService = {
      findByEmail: jest.fn().mockResolvedValue(createUser({ isActive: false })),
      update: jest.fn(),
    };
    const unverifiedService = {
      findByEmail: jest
        .fn()
        .mockResolvedValue(createUser({ isEmailVerified: false })),
      update: jest.fn(),
    };

    await expect(
      promoteExistingUser(inactiveService, "owner@example.com"),
    ).rejects.toThrow("deleted or inactive");
    await expect(
      promoteExistingUser(unverifiedService, "owner@example.com"),
    ).rejects.toThrow("not email-verified");
  });
});
