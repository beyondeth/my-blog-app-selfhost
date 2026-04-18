import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { Post } from "../../posts/entities/post.entity";
import { PostMetadata } from "../../posts/entities/post-metadata.entity";
import { KnowledgeSourceSnapshot } from "../knowledge.types";
import { clampText } from "../utils/knowledge-slug.util";

const KNOWLEDGE_CATEGORY_NORMALIZATION_MAP: Record<string, string> = {
  tech_guides: "개발/기술 가이드",
  coding_templates: "개발/코딩 템플릿",
  ai_workflows: "개발/AI 워크플로",
  data_analytics: "개발/데이터 분석",
  ai_prompts: "개발/AI 프롬프트",
  others: "기타",
};

@Injectable()
export class KnowledgeSourceBuilderService {
  buildSnapshot(post: Post, metadata?: PostMetadata | null): {
    snapshot: KnowledgeSourceSnapshot;
    contentHash: string;
  } {
    const markdown = post.content_markdown || "";
    const renderedContent = post.content || "";
    const category = this.normalizeKnowledgeCategory(metadata?.category);
    const categorySegments = category
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const tags = Array.isArray(metadata?.tags)
      ? metadata.tags.map((tag) => tag.trim()).filter(Boolean)
      : [];
    const headings = this.extractHeadings(markdown, renderedContent);
    const strippedText = clampText(
      this.stripHtml(renderedContent || markdown).replace(/\s+/g, " ").trim(),
      8000,
    );
    const outboundUrls = this.extractOutboundUrls(`${markdown}\n${renderedContent}`);

    const snapshot: KnowledgeSourceSnapshot = {
      title: post.title || "",
      excerpt: metadata?.excerpt || "",
      category,
      categorySegments,
      tags,
      blogSlug: post.blog?.slug || null,
      blogAlias: post.blog?.alias || null,
      contentType: post.content_type || metadata?.content_type || "html",
      markdown,
      renderedContent,
      strippedText,
      headings,
      outboundUrls,
    };

    return {
      snapshot,
      contentHash: this.createContentHash(snapshot),
    };
  }

  private normalizeKnowledgeCategory(value: string | null | undefined): string {
    const cleaned = (value || "").trim();
    if (!cleaned) {
      return "";
    }

    return (
      KNOWLEDGE_CATEGORY_NORMALIZATION_MAP[cleaned] ??
      KNOWLEDGE_CATEGORY_NORMALIZATION_MAP[cleaned.toLowerCase()] ??
      cleaned
    );
  }

  private stripHtml(value: string): string {
    return (value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
  }

  private extractHeadings(markdown: string, renderedContent: string): string[] {
    const headingSet = new Set<string>();
    const markdownMatches = markdown.matchAll(/^#{1,6}\s+(.+)$/gm);

    for (const match of markdownMatches) {
      const heading = match[1]?.trim();
      if (heading) {
        headingSet.add(clampText(heading, 160));
      }
    }

    const htmlMatches = renderedContent.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi);
    for (const match of htmlMatches) {
      const heading = this.stripHtml(match[1] || "").trim();
      if (heading) {
        headingSet.add(clampText(heading, 160));
      }
    }

    return Array.from(headingSet).slice(0, 20);
  }

  private extractOutboundUrls(value: string): string[] {
    const urlSet = new Set<string>();
    const regex = /https?:\/\/[^\s<>"'`)\]]+/gi;

    for (const match of value.matchAll(regex)) {
      if (match[0]) {
        urlSet.add(match[0].trim());
      }
    }

    return Array.from(urlSet).slice(0, 30);
  }

  private createContentHash(snapshot: KnowledgeSourceSnapshot): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          title: snapshot.title,
          excerpt: snapshot.excerpt,
          category: snapshot.category,
          tags: snapshot.tags,
          headings: snapshot.headings,
          strippedText: snapshot.strippedText,
        }),
      )
      .digest("hex");
  }
}
