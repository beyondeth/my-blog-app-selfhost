import {
  buildKnowledgeMockPosts,
  parseSeedArgs,
} from "./knowledge-mock-posts.generator";

describe("knowledge mock generator", () => {
  it("buildKnowledgeMockPosts should generate valid categories and markdown", () => {
    const posts = buildKnowledgeMockPosts({
      count: 120,
      blogAlias: "park1818",
      prefix: "KB",
    });

    expect(posts).toHaveLength(120);
    expect(new Set(posts.map((post) => post.title)).size).toBe(120);
    expect(posts.every((post) => /^.{1,15}$|^.{1,15}\/.{1,15}$/.test(post.category))).toBe(true);
    expect(posts.every((post) => !!post.content_markdown && post.content_markdown.includes("##"))).toBe(true);
  });

  it("parseSeedArgs should parse defaults and custom values", () => {
    const defaultArgs = parseSeedArgs([]);
    expect(defaultArgs.count).toBe(200);
    expect(defaultArgs.blog).toBe("park1818");
    expect(defaultArgs.prefix).toBe("KB");
    expect(defaultArgs.dryRun).toBe(false);

    const parsed = parseSeedArgs([
      "--blog=@demo_user",
      "--count=77",
      "--prefix=TEST",
      "--dry-run",
    ]);

    expect(parsed.count).toBe(77);
    expect(parsed.blog).toBe("demo_user");
    expect(parsed.prefix).toBe("TEST");
    expect(parsed.dryRun).toBe(true);
  });
});
