import { Role } from "../common/enums/role.enum";
import {
  createAdminUserInput,
  validateExistingAdmin,
} from "./create-admin.command";

describe("admin:create account policy", () => {
  it("creates a new account with an explicit ADMIN role", () => {
    const input = createAdminUserInput(
      "admin@example.com",
      "admin",
      "StrongPassword123!",
    );

    expect(input).toMatchObject({
      email: "admin@example.com",
      username: "admin",
      role: Role.ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
  });

  it("only accepts an existing account when it is already an active admin", () => {
    expect(() =>
      validateExistingAdmin(
        {
          role: Role.ADMIN,
          isDeleted: false,
          isEmailVerified: true,
          isActive: true,
        },
        "admin@example.com",
      ),
    ).not.toThrow();

    expect(() =>
      validateExistingAdmin(
        {
          role: Role.USER,
          isDeleted: false,
          isEmailVerified: true,
          isActive: true,
        },
        "user@example.com",
      ),
    ).toThrow("admin:promote");
  });
});
