import { ExecutionContext } from "@nestjs/common";
import { CommunityResourceScopeGuard } from "./community-resource-scope.guard";

describe("CommunityResourceScopeGuard", () => {
  const createContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it("rejects a post id that belongs to another community", async () => {
    const communityRepository = {
      findOne: jest.fn().mockResolvedValue({ id: "community-a", slug: "a" }),
    };
    const postRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const commentRepository = { findOne: jest.fn() };
    const guard = new CommunityResourceScopeGuard(
      communityRepository as any,
      postRepository as any,
      commentRepository as any,
    );

    await expect(
      guard.canActivate(
        createContext({ params: { slug: "a", postId: "post-from-b" } }),
      ),
    ).rejects.toThrow("게시물을 찾을 수 없습니다");
    expect(postRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-from-b", communityId: "community-a" },
      }),
    );
  });

  it("attaches a resource only after its community relationship matches", async () => {
    const request: any = {
      params: { slug: "a", postId: "post-a", commentId: "comment-a" },
      community: { id: "community-a", slug: "a", organizationId: "org-a" },
    };
    const post = { id: "post-a", communityId: "community-a" };
    const comment = {
      id: "comment-a",
      postId: "post-a",
      communityId: "community-a",
    };
    const postRepository = { findOne: jest.fn().mockResolvedValue(post) };
    const commentRepository = { findOne: jest.fn().mockResolvedValue(comment) };
    const guard = new CommunityResourceScopeGuard(
      { findOne: jest.fn() } as any,
      postRepository as any,
      commentRepository as any,
    );

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.communityPost).toBe(post);
    expect(request.communityComment).toBe(comment);
  });
});
