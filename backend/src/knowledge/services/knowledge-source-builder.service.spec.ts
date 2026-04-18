import { Post } from "../../posts/entities/post.entity";
import { PostMetadata } from "../../posts/entities/post-metadata.entity";
import { KnowledgeSourceBuilderService } from "./knowledge-source-builder.service";

describe("KnowledgeSourceBuilderService", () => {
  const service = new KnowledgeSourceBuilderService();

  it("builds a normalized snapshot with category segments, headings, and outbound urls", () => {
    const post = {
      title: "Next.js Cache Tags",
      content_markdown: [
        "# Intro",
        "See https://example.com/docs for details.",
        "## Deep Dive",
      ].join("\n"),
      content: [
        "<h1>Intro</h1>",
        "<p>Rendered explanation</p>",
        '<a href="https://openai.com/research">OpenAI</a>',
      ].join(""),
      content_type: "markdown",
      blog: {
        slug: "park1818-blog",
        alias: "park1818",
      },
    } as Post;
    const metadata = {
      category: "개발/Frontend",
      tags: ["Next.js", "Cache Tags", "RSC"],
      excerpt: "캐시 태그 운영 노트",
    } as PostMetadata;

    const { snapshot, contentHash } = service.buildSnapshot(post, metadata);

    expect(snapshot.category).toBe("개발/Frontend");
    expect(snapshot.categorySegments).toEqual(["개발", "Frontend"]);
    expect(snapshot.tags).toEqual(["Next.js", "Cache Tags", "RSC"]);
    expect(snapshot.blogSlug).toBe("park1818-blog");
    expect(snapshot.blogAlias).toBe("park1818");
    expect(snapshot.headings).toEqual(expect.arrayContaining(["Intro", "Deep Dive"]));
    expect(snapshot.outboundUrls).toEqual(
      expect.arrayContaining([
        "https://example.com/docs",
        "https://openai.com/research",
      ]),
    );
    expect(snapshot.strippedText).toContain("Rendered explanation");
    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the same content hash for the same semantic payload", () => {
    const post = {
      title: "Stable Hash",
      content_markdown: "# Heading",
      content: "<h1>Heading</h1><p>Hello world</p>",
      content_type: "html",
    } as Post;
    const metadata = {
      category: "개발/Backend",
      tags: ["NestJS"],
      excerpt: "excerpt",
    } as PostMetadata;

    const first = service.buildSnapshot(post, metadata);
    const second = service.buildSnapshot(post, metadata);

    expect(first.contentHash).toBe(second.contentHash);
  });
});
