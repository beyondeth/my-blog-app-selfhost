import { CacheInvalidationListener } from "./cache-invalidation.listener";

describe("CacheInvalidationListener", () => {
  it("invalidates both blogSlug and blogId feed cache patterns on post change", async () => {
    const cacheService = {
      deletePattern: jest.fn().mockResolvedValue(undefined),
    };
    const blogsService = {
      findByUserId: jest.fn(),
    };
    const listener = new CacheInvalidationListener(
      cacheService as any,
      blogsService as any,
    );

    await listener.handlePostChange({
      postId: "post-1",
      blogSlug: "my-blog",
      blogId: "019a77ab-d4c1-7313-bd30-3485ae91e7af",
    });

    expect(cacheService.deletePattern).toHaveBeenCalledWith("feed:unified:*");
    expect(cacheService.deletePattern).toHaveBeenCalledWith(
      "feed:blog:my-blog:page:*",
    );
    expect(cacheService.deletePattern).toHaveBeenCalledWith(
      "feed:blog:019a77ab-d4c1-7313-bd30-3485ae91e7af:page:*",
    );
    expect(cacheService.deletePattern).toHaveBeenCalledWith("post:core:post-1");
  });
});
