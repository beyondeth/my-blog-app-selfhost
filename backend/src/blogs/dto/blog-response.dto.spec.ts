import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { BlogResponseDto } from "./blog-response.dto";

describe("BlogResponseDto", () => {
  it("should expose branding fields when plain object is transformed", () => {
    const blog: any = {
      id: "blog-1",
      slug: "slog",
      alias: "alias",
      name: "My Blog",
      description: "Desc",
      thumbnailUrl: "thumb",
      isPublic: true,
      allowComments: true,
      userId: "user-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      logoUrl: "https://cdn/logo.webp",
      iconUrl: "https://cdn/icon.webp",
      coverImageUrl: "https://cdn/cover.webp",
      brandColor: "#FF5722",
    };

    const dto = plainToInstance(BlogResponseDto, blog, {
      excludeExtraneousValues: true,
    });

    expect(dto.logoUrl).toBe(blog.logoUrl);
    expect(dto.iconUrl).toBe(blog.iconUrl);
    expect(dto.coverImageUrl).toBe(blog.coverImageUrl);
    expect(dto.brandColor).toBe(blog.brandColor);
  });
});
