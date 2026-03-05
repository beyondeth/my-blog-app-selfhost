import { PostAccessPolicyService } from "./post-access-policy.service";

describe("PostAccessPolicyService", () => {
  const service = new PostAccessPolicyService();

  it("returns public effectiveVisibility only when post and blog are both publicly readable", () => {
    expect(
      service.getEffectiveVisibility(
        { isPublished: true, isDeleted: false, visibility: "public" },
        { isPublic: true },
      ),
    ).toBe("public");
  });

  it("returns private effectiveVisibility when blog is private even if post visibility is public", () => {
    expect(
      service.getEffectiveVisibility(
        { isPublished: true, isDeleted: false, visibility: "public" },
        { isPublic: false },
      ),
    ).toBe("private");
  });

  it("marks visibilityBlockedByBlogPrivacy when post is public but blog is private", () => {
    expect(
      service.isVisibilityBlockedByBlogPrivacy(
        { visibility: "public" },
        { isPublic: false },
      ),
    ).toBe(true);
    expect(
      service.isVisibilityBlockedByBlogPrivacy(
        { visibility: "private" },
        { isPublic: false },
      ),
    ).toBe(false);
  });
});
