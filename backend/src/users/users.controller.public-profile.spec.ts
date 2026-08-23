import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import { UsersController } from "./users.controller";

describe("UsersController public profile contract", () => {
  it("returns only explicitly exposed public profile fields", async () => {
    const usersService = {
      findOne: jest.fn(async () => ({
        id: "user-1",
        username: "author",
        profileImage: "/avatar.webp",
        bio: "Public bio",
        email: "private@example.com",
        password: "hashed-password",
        refreshToken: "private-refresh-token",
        accountSettings: { refreshToken: "nested-private-token" },
      })),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.findOne("user-1");

    expect(result).toEqual({
      id: "user-1",
      username: "author",
      profileImage: "/avatar.webp",
      bio: "Public bio",
    });
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.findOne)).toBe(true);
  });
});
