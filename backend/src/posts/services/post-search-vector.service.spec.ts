import { PostSearchVectorService } from "./post-search-vector.service";

describe("PostSearchVectorService", () => {
  it("builds a normalized search text from title, excerpt, tags, and content", () => {
    const service = new PostSearchVectorService({} as any);

    const searchText = service.buildSearchText({
      title: "React Hooks Deep Dive",
      excerpt: "How to avoid stale closures",
      tags: ["react", "hooks"],
      content: "<p>Ignored when markdown exists</p>",
      content_markdown: "## Intro\n\nUse `useEffectEvent` when appropriate.",
    });

    expect(searchText).toContain("React Hooks Deep Dive");
    expect(searchText).toContain("How to avoid stale closures");
    expect(searchText).toContain("react hooks");
    expect(searchText).toContain("Intro Use useEffectEvent when appropriate.");
  });
});
