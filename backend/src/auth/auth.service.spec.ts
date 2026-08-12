import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthProvider, User } from "../users/entities/user.entity";
import { IdentityProvider } from "../users/entities/user-identity.entity";

describe("AuthService social authentication", () => {
  let service: AuthService;
  let usersService: {
    findByEmailIncludingDeleted: jest.Mock;
    update: jest.Mock;
    updateLastLogin: jest.Mock;
  };
  let blogsService: {
    findByUserId: jest.Mock;
  };
  let identityService: {
    findByProviderId: jest.Mock;
    linkIdentity: jest.Mock;
    isTrustedProvider: jest.Mock;
  };

  const authResponse = {
    access_token: "access-token",
    refresh_token: "refresh-token",
    token_type: "Bearer" as const,
    expires_in: 86_400,
    user: { id: "user-1" },
  };

  const blog = {
    id: "blog-1",
    slug: "same-user",
    name: "Same User",
    description: "A test blog",
    isPublic: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const createUser = (overrides: Partial<User> = {}): User =>
    ({
      id: "user-1",
      email: "same@example.com",
      username: "same-user",
      authProvider: AuthProvider.GITHUB,
      providerId: "github-user-1",
      isEmailVerified: true,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      isBanned: false,
      suspensionUntil: null,
      profileImage: null,
      ...overrides,
    }) as User;

  beforeEach(() => {
    usersService = {
      findByEmailIncludingDeleted: jest.fn(),
      update: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    blogsService = {
      findByUserId: jest.fn().mockResolvedValue([blog]),
    };
    identityService = {
      findByProviderId: jest.fn().mockResolvedValue(null),
      linkIdentity: jest.fn().mockResolvedValue({
        id: "identity-google-1",
        userId: "user-1",
        provider: IdentityProvider.GOOGLE,
        providerId: "google-user-1",
      }),
      isTrustedProvider: jest.fn().mockReturnValue(true),
    };

    service = new AuthService(
      {} as any,
      usersService as any,
      blogsService as any,
      {} as any,
      identityService as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn(service as any, "generateTokenResponse")
      .mockResolvedValue(authResponse);
  });

  it("links Google to an existing GitHub account with the same verified email", async () => {
    const existingUser = createUser();
    usersService.findByEmailIncludingDeleted.mockResolvedValue(existingUser);

    const result = await service.validateOAuthUser(
      {
        id: "google-user-1",
        email: existingUser.email,
        displayName: "Same User",
      },
      AuthProvider.GOOGLE,
    );

    expect(result).toBe(authResponse);
    expect(identityService.linkIdentity).toHaveBeenCalledWith(
      existingUser.id,
      expect.objectContaining({
        provider: IdentityProvider.GOOGLE,
        providerId: "google-user-1",
        email: existingUser.email,
      }),
    );
    expect(usersService.updateLastLogin).toHaveBeenCalledWith(
      existingUser.id,
      AuthProvider.GOOGLE,
    );
  });

  it("rejects a social login for an existing inactive account before linking an identity", async () => {
    const inactiveUser = createUser({ isActive: false });
    usersService.findByEmailIncludingDeleted.mockResolvedValue(inactiveUser);

    let error: UnauthorizedException;
    try {
      await service.validateOAuthUser(
        {
          id: "google-user-1",
          email: inactiveUser.email,
          displayName: "Inactive User",
        },
        AuthProvider.GOOGLE,
      );
      throw new Error("Expected inactive account login to be rejected");
    } catch (caughtError) {
      error = caughtError as UnauthorizedException;
    }

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: "ACCOUNT_INACTIVE" }),
    );
    expect(identityService.linkIdentity).not.toHaveBeenCalled();
    expect(usersService.updateLastLogin).not.toHaveBeenCalled();
  });
});
