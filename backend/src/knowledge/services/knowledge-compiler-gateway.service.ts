import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import {
  KNOWLEDGE_MAX_EDGES,
  KNOWLEDGE_MAX_FOLLOWUPS,
  KNOWLEDGE_MAX_PRIMARY_NODES,
  KNOWLEDGE_MAX_SECONDARY_NODES,
} from "../knowledge.constants";
import {
  KnowledgeCompileContext,
  KnowledgeCompileResult,
} from "../knowledge.types";
import { getKnowledgeSignalTerms } from "../utils/knowledge-signal.util";
import { resolveKnowledgeSourceTaxonomy } from "../utils/knowledge-taxonomy.util";
import { clampText, toKnowledgeSlug } from "../utils/knowledge-slug.util";

@Injectable()
export class KnowledgeCompilerGatewayService {
  private readonly logger = new Logger(KnowledgeCompilerGatewayService.name);

  constructor(private readonly configService: ConfigService) {}

  async compile(context: KnowledgeCompileContext): Promise<KnowledgeCompileResult> {
    const enabled = this.configService.get<string>("KB_COMPILER_ENABLED");
    const apiKey = this.configService.get<string>("KB_COMPILER_API_KEY");
    const baseUrl = this.configService.get<string>("KB_COMPILER_BASE_URL");
    const model = this.configService.get<string>("KB_COMPILER_MODEL");

    if (!enabled || enabled === "false" || !apiKey || !baseUrl || !model) {
      return this.buildHeuristicResult(context);
    }

    try {
      const endpoint = /\/(responses|chat\/completions)$/.test(baseUrl)
        ? baseUrl
        : `${baseUrl.replace(/\/$/, "")}/responses`;
      const payload = {
        model,
        input: [
          {
            role: "system",
            content:
              "You compile a personal knowledge graph for blog posts. Return strict JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              source: context.source,
              manifest: context.manifest,
              candidates: context.candidates,
              limits: {
                primaryNodes: KNOWLEDGE_MAX_PRIMARY_NODES,
                secondaryNodes: KNOWLEDGE_MAX_SECONDARY_NODES,
                edges: KNOWLEDGE_MAX_EDGES,
                followups: KNOWLEDGE_MAX_FOLLOWUPS,
              },
            }),
          },
        ],
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      const parsed = this.extractStructuredResult(response.data);
      if (!parsed) {
        throw new Error("KB compiler returned an invalid payload");
      }

      return parsed;
    } catch (error) {
      this.logger.warn(
        `Falling back to heuristic KB compile: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.buildHeuristicResult(context);
    }
  }

  private extractStructuredResult(payload: any): KnowledgeCompileResult | null {
    const rawText =
      payload?.output_text ||
      payload?.choices?.[0]?.message?.content ||
      payload?.choices?.[0]?.text;

    if (typeof rawText !== "string" || !rawText.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawText);
      return {
        mode: "llm",
        primaryNodes: Array.isArray(parsed.primaryNodes)
          ? parsed.primaryNodes.slice(0, KNOWLEDGE_MAX_PRIMARY_NODES)
          : [],
        secondaryNodes: Array.isArray(parsed.secondaryNodes)
          ? parsed.secondaryNodes.slice(0, KNOWLEDGE_MAX_SECONDARY_NODES)
          : [],
        edges: Array.isArray(parsed.edges)
          ? parsed.edges.slice(0, KNOWLEDGE_MAX_EDGES)
          : [],
        postLinks: Array.isArray(parsed.postLinks) ? parsed.postLinks : [],
        followups: Array.isArray(parsed.followups)
          ? parsed.followups.slice(0, KNOWLEDGE_MAX_FOLLOWUPS)
          : [],
      };
    } catch {
      return null;
    }
  }

  private buildHeuristicResult(
    context: KnowledgeCompileContext,
  ): KnowledgeCompileResult {
    const taxonomy = resolveKnowledgeSourceTaxonomy(context.source);
    const { signalTags } = getKnowledgeSignalTerms(context.source);
    const fallbackPrimaryTag = signalTags[0] || context.source.title;
    const fallbackPrimaryTitle = clampText(fallbackPrimaryTag || "", 160);
    const shouldUseFallbackTopic =
      !taxonomy.topic &&
      taxonomy.root.generic &&
      fallbackPrimaryTitle &&
      toKnowledgeSlug(fallbackPrimaryTitle) !== taxonomy.root.slug;
    const primaryTitle = clampText(
      taxonomy.topic?.title ||
        (shouldUseFallbackTopic ? fallbackPrimaryTitle : taxonomy.root.title),
      160,
    );
    const primarySlug = toKnowledgeSlug(primaryTitle);
    const primaryNodeType =
      taxonomy.topic || shouldUseFallbackTopic ? "topic" : "domain";
    const parentSlug =
      taxonomy.topic || shouldUseFallbackTopic ? taxonomy.root.slug : null;

    const secondaryTags = signalTags
      .filter((tag) => {
        const slug = toKnowledgeSlug(tag);
        return slug !== primarySlug && slug !== taxonomy.root.slug;
      })
      .slice(0, KNOWLEDGE_MAX_SECONDARY_NODES);

    const secondaryNodes = secondaryTags.map((tag) => ({
      slug: toKnowledgeSlug(tag),
      title: clampText(tag, 160),
      nodeType: "concept" as const,
      parentSlug: primarySlug,
      summary: clampText(
        `${tag} is a recurring concept in posts under ${primaryTitle}.`,
        220,
      ),
    }));

    const postLinks = [
      {
        nodeSlug: primarySlug,
        role: "primary" as const,
        confidence: 0.8,
      },
      ...secondaryNodes.map((node) => ({
        nodeSlug: node.slug,
        role: "secondary" as const,
        confidence: 0.6,
      })),
    ];

    const followups = secondaryNodes.slice(0, KNOWLEDGE_MAX_FOLLOWUPS).map((node) => ({
      title: `${node.title} 실전 활용 후속 글`,
      nodeSlug: node.slug,
      reason: `${node.title} concept has enough overlap to justify a follow-up post.`,
    }));

    const edges = secondaryNodes
      .slice(0, Math.min(secondaryNodes.length, 2))
      .map((node) => ({
        fromSlug: primarySlug,
        toSlug: node.slug,
        relation: "followup_to" as const,
        confidence: 0.42,
        reason: `${node.title} is a strong secondary concept in the same post context.`,
      }));

    return {
      mode: "heuristic",
      primaryNodes: [
        {
          slug: primarySlug,
          title: primaryTitle,
          nodeType: primaryNodeType,
          parentSlug,
          summary: clampText(
            context.source.excerpt ||
              `${primaryTitle} related writing collected from the user's blog.`,
            220,
          ),
        },
      ],
      secondaryNodes,
      edges,
      postLinks,
      followups,
    };
  }
}
