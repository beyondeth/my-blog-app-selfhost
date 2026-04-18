import { Injectable } from "@nestjs/common";
import {
  KnowledgeCompileResult,
  KnowledgeDraft,
  KnowledgeSourceArtifactPayload,
  KnowledgeArtifactSectionNode,
  KnowledgeSourceSnapshot,
} from "../knowledge.types";
import { clampText, toKnowledgeSlug } from "../utils/knowledge-slug.util";

@Injectable()
export class KnowledgeArtifactService {
  buildArtifact(params: {
    source: KnowledgeSourceSnapshot;
    compileResult: KnowledgeCompileResult;
    draft?: KnowledgeDraft | null;
  }): KnowledgeSourceArtifactPayload {
    const sectionTree = this.buildSectionTree(params.source);
    const draft = params.draft || null;

    return {
      declaredMetadata: {
        category: params.source.category,
        categorySegments: params.source.categorySegments,
        tags: params.source.tags,
        headings: params.source.headings,
        outboundUrls: params.source.outboundUrls,
        blogSlug: params.source.blogSlug || null,
        blogAlias: params.source.blogAlias || null,
      },
      sectionTree,
      compiled: {
        mode: params.compileResult.mode,
        primaryNodes: params.compileResult.primaryNodes,
        secondaryNodes: params.compileResult.secondaryNodes,
        edges: params.compileResult.edges,
        postLinks: params.compileResult.postLinks,
        followups: params.compileResult.followups,
      },
      draft,
    };
  }

  private buildSectionTree(
    source: KnowledgeSourceSnapshot,
  ): KnowledgeArtifactSectionNode[] {
    const markdownSections = this.buildSectionTreeFromMarkdown(source.markdown || "");
    if (markdownSections.length > 0) {
      return markdownSections;
    }

    if (!source.headings.length) {
      return [];
    }

    const stack: KnowledgeArtifactSectionNode[] = [];
    const roots: KnowledgeArtifactSectionNode[] = [];

    source.headings.forEach((heading, index) => {
      const normalized = clampText((heading || "").replace(/\s+/g, " ").trim(), 160);
      if (!normalized) {
        return;
      }

      const explicitLevel = this.extractExplicitLevel(heading);
      const level = explicitLevel ?? this.inferLevel(index);
      const node: KnowledgeArtifactSectionNode = {
        id: `${toKnowledgeSlug(normalized)}-${index + 1}`,
        title: normalized.replace(/^#+\s*/, ""),
        level,
        summary: null,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return roots;
  }

  private buildSectionTreeFromMarkdown(markdown: string) {
    const lines = (markdown || "").split(/\r?\n/);
    const sections: Array<{
      title: string;
      level: number;
      bodyLines: string[];
    }> = [];

    let current: {
      title: string;
      level: number;
      bodyLines: string[];
    } | null = null;

    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        if (current) {
          sections.push(current);
        }
        current = {
          title: clampText(match[2].trim(), 160),
          level: match[1].length,
          bodyLines: [],
        };
        return;
      }

      if (current) {
        current.bodyLines.push(line);
      }
    });

    if (current) {
      sections.push(current);
    }

    if (sections.length === 0) {
      return [];
    }

    const roots: KnowledgeArtifactSectionNode[] = [];
    const stack: KnowledgeArtifactSectionNode[] = [];

    sections.forEach((section, index) => {
      if (!section.title) {
        return;
      }

      const node: KnowledgeArtifactSectionNode = {
        id: `${toKnowledgeSlug(section.title)}-${index + 1}`,
        title: section.title,
        level: section.level,
        summary: this.summarizeSectionBody(section.bodyLines),
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return roots;
  }

  private summarizeSectionBody(lines: string[]) {
    const normalized = clampText(
      lines
        .join(" ")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]+`/g, " ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/[*_>#-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      260,
    );

    return normalized || null;
  }

  private extractExplicitLevel(value: string) {
    const match = value.match(/^(#{1,6})\s+/);
    return match ? match[1].length : null;
  }

  private inferLevel(index: number) {
    if (index === 0) {
      return 1;
    }
    if (index <= 2) {
      return 2;
    }
    return 3;
  }
}
