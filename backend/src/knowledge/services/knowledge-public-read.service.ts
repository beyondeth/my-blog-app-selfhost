import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { Role } from "../../common/enums/role.enum";
import { Blog } from "../../blogs/entities/blog.entity";
import { Post } from "../../posts/entities/post.entity";
import { PostMetadata } from "../../posts/entities/post-metadata.entity";
import { KnowledgeEdge } from "../entities/knowledge-edge.entity";
import { KnowledgeFollowupSuggestion } from "../entities/knowledge-followup-suggestion.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import { KnowledgeSource } from "../entities/knowledge-source.entity";
import { PostKnowledgeLink } from "../entities/post-knowledge-link.entity";
import { User } from "../../users/entities/user.entity";
import { PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES } from "../knowledge.constants";
import {
  getKnowledgeNodeCanonicalRoot,
  normalizeKnowledgeRootTitle,
} from "../utils/knowledge-taxonomy.util";

interface VisibleNodeRow {
  id: string;
  slug: string;
  title: string;
  canonicalPath: string;
  summary: string | null;
  nodeType: string;
  parentNodeId: string | null;
  evidenceCount: number;
  postCount: number;
  updatedAt: Date | null;
}

interface BlogNodeProjection {
  directNodes: VisibleNodeRow[];
  allNodesMap: Map<string, VisibleNodeRow>;
  childrenMap: Map<string | null, VisibleNodeRow[]>;
  directNodeIds: Set<string>;
}

interface RootFamily {
  representative: VisibleNodeRow;
  members: VisibleNodeRow[];
  displayChildren: VisibleNodeRow[];
}

interface RootFamilyProjection {
  families: RootFamily[];
  familyByRepresentativeId: Map<string, RootFamily>;
  familyByMemberId: Map<string, RootFamily>;
}

interface ContextRootFamily {
  representative: VisibleNodeRow;
  members: VisibleNodeRow[];
}

interface PostKnowledgeContextProjection {
  allNodesMap: Map<string, VisibleNodeRow>;
  rootFamilyByMemberId: Map<string, ContextRootFamily>;
}

interface CanvasDisplayNode extends VisibleNodeRow {
  depth: number;
  isOnFocusPath: boolean;
}

interface CanvasFactEdgeGroup {
  edgeKey: string;
  fromSlug: string;
  toSlug: string;
  relationType: string;
  confidence: number | null;
  reason: string | null;
  evidenceCount: number;
  sourceIds: Set<string>;
}

export type FlowBoardItemKind =
  | "path"
  | "focus"
  | "child"
  | "prerequisite"
  | "followup"
  | "duplicate";

export interface FlowBoardItem {
  slug: string;
  title: string;
  canonicalPath: string;
  summary: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  kind: FlowBoardItemKind;
}

export type FlowBoardPanelLayoutHint =
  | "right"
  | "bottomLeft"
  | "bottomRight"
  | "bottom";

interface FlowBoardEvidencePost {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  excerpt: string | null;
  category: string | null;
  thumbnail: string | null;
  blog: {
    slug: string | null;
    alias: string | null;
    name: string | null;
  };
}

interface FlowBoardPanelDraft {
  id: string;
  title: string;
  kind: FlowBoardItemKind;
  layoutHint: FlowBoardPanelLayoutHint;
  items: VisibleNodeRow[];
}

export interface FlowBoardPanel {
  id: string;
  title: string;
  items: FlowBoardItem[];
  evidencePosts: FlowBoardEvidencePost[];
  layoutHint: FlowBoardPanelLayoutHint;
}

@Injectable()
export class KnowledgePublicReadService {
  private readonly logger = new Logger(KnowledgePublicReadService.name);

  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostMetadata)
    private readonly postMetadataRepository: Repository<PostMetadata>,
    @InjectRepository(KnowledgeNode)
    private readonly knowledgeNodeRepository: Repository<KnowledgeNode>,
    @InjectRepository(KnowledgeEdge)
    private readonly knowledgeEdgeRepository: Repository<KnowledgeEdge>,
    @InjectRepository(KnowledgeSource)
    private readonly knowledgeSourceRepository: Repository<KnowledgeSource>,
    @InjectRepository(PostKnowledgeLink)
    private readonly postKnowledgeLinkRepository: Repository<PostKnowledgeLink>,
    @InjectRepository(KnowledgeFollowupSuggestion)
    private readonly knowledgeFollowupRepository: Repository<KnowledgeFollowupSuggestion>,
  ) {}

  async getBlogKnowledgeTree(blog: Blog, viewer?: User) {
    const projection = await this.getBlogNodeProjection(blog, viewer);
    const aggregatePostCounts = this.buildAggregatePostCountMap(projection);
    const rootFamilies = this.buildRootFamilyProjection(
      projection,
      aggregatePostCounts,
    );
    const roots = this.buildTree(projection, aggregatePostCounts, rootFamilies);

    const hotNodes = projection.directNodes
      .slice()
      .sort((left, right) => {
        if (right.postCount !== left.postCount) {
          return right.postCount - left.postCount;
        }
        if (right.evidenceCount !== left.evidenceCount) {
          return right.evidenceCount - left.evidenceCount;
        }
        return left.title.localeCompare(right.title, "ko");
      })
      .slice(0, 6)
      .map((node) => ({
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        postCount: node.postCount,
        evidenceCount: node.evidenceCount,
      }));

    return {
      tree: roots,
      hotNodes,
      nodeCount: projection.directNodes.length,
      lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
    };
  }

  async getBlogKnowledgeMap(
    blog: Blog,
    viewer?: User,
    focusSlug?: string,
    limit = 12,
  ) {
    const projection = await this.getBlogNodeProjection(blog, viewer);
    const aggregatePostCounts = this.buildAggregatePostCountMap(projection);
    const rootFamilies = this.buildRootFamilyProjection(
      projection,
      aggregatePostCounts,
    );
    const rankedDirectNodes = this.getRankedDirectNodes(projection);
    const hotNodes = rankedDirectNodes
      .slice(0, 6)
      .map((node) => ({
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        postCount: node.postCount,
        evidenceCount: node.evidenceCount,
      }));

    if (projection.directNodes.length === 0) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        focusNode: null,
        nodes: [],
        edges: [],
        contextNodes: [],
        hotNodes,
        nodeCount: 0,
        lastUpdatedAt: null,
        hasExplicitEdges: false,
      };
    }

    const rawFocusNode =
      Array.from(projection.allNodesMap.values()).find(
        (node) => node.slug === focusSlug,
      ) ?? projection.directNodes[0] ?? null;

    if (!rawFocusNode) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        focusNode: null,
        nodes: [],
        edges: [],
        contextNodes: [],
        hotNodes,
        nodeCount: projection.directNodes.length,
        lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
        hasExplicitEdges: false,
      };
    }

    const focusFamily =
      !rawFocusNode.parentNodeId
        ? rootFamilies.familyByMemberId.get(rawFocusNode.id) ?? null
        : null;
    const focusNode = focusFamily?.representative ?? rawFocusNode;
    const focusQueryNodeIds = focusFamily
      ? focusFamily.members.map((member) => member.id)
      : [rawFocusNode.id];
    const safeLimit = Math.min(Math.max(limit, 1), 24);
    const edges = await this.knowledgeEdgeRepository.find({
      where: [
        {
          userId: blog.userId,
          fromNodeId: In(focusQueryNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
        {
          userId: blog.userId,
          toNodeId: In(focusQueryNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
      ],
      order: {
        evidenceCount: "DESC",
        updatedAt: "DESC",
      },
      take: safeLimit,
    });

    const nodeIds = new Set<string>([focusNode.id]);
    const seenEdgeKeys = new Set<string>();
    const mapEdges = edges
      .map((edge) => {
        const rawFromNode = projection.allNodesMap.get(edge.fromNodeId);
        const rawToNode = projection.allNodesMap.get(edge.toNodeId);
        if (!rawFromNode || !rawToNode) {
          return null;
        }

        const fromNode = this.getDisplayNode(rawFromNode, rootFamilies);
        const toNode = this.getDisplayNode(rawToNode, rootFamilies);
        if (fromNode.id === toNode.id) {
          return null;
        }

        const edgeKey = `${fromNode.id}::${edge.relationType}::${toNode.id}`;
        if (seenEdgeKeys.has(edgeKey)) {
          return null;
        }
        seenEdgeKeys.add(edgeKey);

        nodeIds.add(fromNode.id);
        nodeIds.add(toNode.id);

        return {
          fromSlug: fromNode.slug,
          toSlug: toNode.slug,
          relationType: edge.relationType,
          confidence: edge.confidence,
          reason: edge.reason,
          evidenceCount: edge.evidenceCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const mapNodes = Array.from(nodeIds)
      .map((nodeId) => projection.allNodesMap.get(nodeId))
      .filter((item): item is VisibleNodeRow => Boolean(item))
      .sort((left, right) => {
        if (left.id === focusNode.id) return -1;
        if (right.id === focusNode.id) return 1;
        const leftPostCount = this.getDisplayPostCount(
          left,
          aggregatePostCounts,
          rootFamilies,
        );
        const rightPostCount = this.getDisplayPostCount(
          right,
          aggregatePostCounts,
          rootFamilies,
        );
        if (rightPostCount !== leftPostCount) {
          return rightPostCount - leftPostCount;
        }
        const leftEvidenceCount = this.getDisplayEvidenceCount(
          left,
          rootFamilies,
        );
        const rightEvidenceCount = this.getDisplayEvidenceCount(
          right,
          rootFamilies,
        );
        if (rightEvidenceCount !== leftEvidenceCount) {
          return rightEvidenceCount - leftEvidenceCount;
        }
        return left.title.localeCompare(right.title, "ko");
      })
      .map((node) =>
        this.toKnowledgeMapNode(
          node,
          aggregatePostCounts,
          rootFamilies,
          node.id === focusNode.id,
        ),
      );

    const hasExplicitEdges = mapEdges.length > 0;
    const contextNodes = this.buildKnowledgeMapContextNodes({
      focusNode: rawFocusNode,
      projection,
      aggregatePostCounts,
      rootFamilies,
      rankedDirectNodes,
      excludedNodeIds: nodeIds,
      limit: hasExplicitEdges ? 6 : 8,
    });

    return {
      requestedFocusSlug: focusSlug ?? null,
      resolvedFocusSlug: focusNode.slug,
      requestedFocusFound: focusSlug ? rawFocusNode.slug === focusSlug : true,
      focusNode: this.toKnowledgeMapFocusNode(
        focusNode,
        aggregatePostCounts,
        rootFamilies,
      ),
      nodes: mapNodes,
      edges: mapEdges,
      contextNodes,
      hotNodes,
      nodeCount: projection.directNodes.length,
      lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
      hasExplicitEdges,
    };
  }

  async getBlogKnowledgeCanvas(
    blog: Blog,
    viewer?: User,
    focusSlug?: string,
    limit = 36,
  ) {
    const projection = await this.getBlogNodeProjection(blog, viewer);
    const aggregatePostCounts = this.buildAggregatePostCountMap(projection);
    const rootFamilies = this.buildRootFamilyProjection(
      projection,
      aggregatePostCounts,
    );
    const rankedDirectNodes = this.getRankedDirectNodes(projection);
    const hotNodes = rankedDirectNodes
      .slice(0, 6)
      .map((node) => ({
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        postCount: node.postCount,
        evidenceCount: node.evidenceCount,
      }));

    if (projection.directNodes.length === 0) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        rootNode: null,
        focusNode: null,
        pathFromRoot: [],
        nodes: [],
        treeEdges: [],
        factEdges: [],
        provenance: {
          nodes: {},
          edges: [],
        },
        insights: null,
        viewerCanSeeInsights: false,
        hotNodes,
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const rawFocusNode =
      Array.from(projection.allNodesMap.values()).find(
        (node) => node.slug === focusSlug,
      ) ?? projection.directNodes[0] ?? null;

    if (!rawFocusNode) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        rootNode: null,
        focusNode: null,
        pathFromRoot: [],
        nodes: [],
        treeEdges: [],
        factEdges: [],
        provenance: {
          nodes: {},
          edges: [],
        },
        insights: null,
        viewerCanSeeInsights: false,
        hotNodes,
        nodeCount: projection.directNodes.length,
        lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
      };
    }

    const displayFocusNode = this.getDisplayNode(rawFocusNode, rootFamilies);
    const pathFromRoot = this.buildDisplayPathFromRoot(
      rawFocusNode,
      projection.allNodesMap,
      rootFamilies,
    );
    const rootNode = pathFromRoot[0] ?? displayFocusNode;
    const safeLimit = Math.min(Math.max(limit, 8), 60);
    const canvasNodes = this.buildCanvasDisplayNodes({
      rootNode,
      pathFromRoot,
      projection,
      aggregateCounts: aggregatePostCounts,
      rootFamilies,
      limit: safeLimit,
    });
    const includedNodeMap = new Map(
      canvasNodes.map((node) => [node.id, node]),
    );
    const treeEdges = this.buildCanvasTreeEdges(
      rootNode,
      projection,
      rootFamilies,
      includedNodeMap,
    );
    const factEdges = await this.buildCanvasFactEdges({
      blog,
      projection,
      rootFamilies,
      includedNodeMap,
      includePrivate: this.canAccessPrivateBlog(blog, viewer),
    });
    const provenance = await this.buildCanvasProvenance({
      blog,
      projection,
      rootFamilies,
      includedNodeMap,
      factEdges,
      includePrivate: this.canAccessPrivateBlog(blog, viewer),
    });

    const viewerCanSeeInsights = this.canAccessPrivateBlog(blog, viewer);
    const focusNodeIds = this.getDisplayNodeRawIds(displayFocusNode, rootFamilies);
    const insightFollowups = viewerCanSeeInsights
      ? await this.knowledgeFollowupRepository.find({
          where: {
            userId: blog.userId,
            nodeId: In(focusNodeIds),
            status: "pending",
          },
          order: { updatedAt: "DESC" },
          take: 6,
        })
      : [];

    return {
      requestedFocusSlug: focusSlug ?? null,
      resolvedFocusSlug: displayFocusNode.slug,
      requestedFocusFound: focusSlug ? rawFocusNode.slug === focusSlug : true,
      rootNode: this.toKnowledgeCanvasNode(
        rootNode,
        aggregatePostCounts,
        rootFamilies,
        0,
        true,
      ),
      focusNode: this.toKnowledgeCanvasNode(
        displayFocusNode,
        aggregatePostCounts,
        rootFamilies,
        pathFromRoot.findIndex((item) => item.id === displayFocusNode.id),
        true,
      ),
      pathFromRoot: pathFromRoot.map((node, index) =>
        this.toKnowledgeCanvasNode(
          node,
          aggregatePostCounts,
          rootFamilies,
          index,
          true,
        ),
      ),
      nodes: canvasNodes.map((node) =>
        this.toKnowledgeCanvasNode(
          node,
          aggregatePostCounts,
          rootFamilies,
          node.depth,
          node.isOnFocusPath,
        ),
      ),
      treeEdges,
      factEdges: factEdges.map((edge) => ({
        edgeKey: edge.edgeKey,
        fromSlug: edge.fromSlug,
        toSlug: edge.toSlug,
        relationType: edge.relationType,
        confidence: edge.confidence,
        reason: edge.reason,
        evidenceCount: edge.evidenceCount,
      })),
      provenance,
      insights: viewerCanSeeInsights
        ? {
            followups: insightFollowups.map((followup) => ({
              id: followup.id,
              title: followup.title,
              reason: followup.reason,
              status: followup.status,
              nodeSlug: followup.nodeId
                ? this.getDisplayNode(
                    projection.allNodesMap.get(followup.nodeId) ??
                      displayFocusNode,
                    rootFamilies,
                  ).slug
                : null,
              postId: followup.postId,
            })),
          }
        : null,
      viewerCanSeeInsights,
      hotNodes,
      nodeCount: projection.directNodes.length,
      lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
    };
  }

  async getBlogKnowledgeFlowBoard(
    blog: Blog,
    viewer?: User,
    focusSlug?: string,
    limit = 24,
  ) {
    const projection = await this.getBlogNodeProjection(blog, viewer);
    const aggregatePostCounts = this.buildAggregatePostCountMap(projection);
    const rootFamilies = this.buildRootFamilyProjection(
      projection,
      aggregatePostCounts,
    );
    const rankedDirectNodes = this.getRankedDirectNodes(projection);
    const hotNodes = rankedDirectNodes
      .slice(0, 6)
      .map((node) => ({
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        postCount: node.postCount,
        evidenceCount: node.evidenceCount,
      }));

    if (projection.directNodes.length === 0) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        rootPath: [],
        focus: null,
        primaryFlow: null,
        detailPanels: [],
        hotNodes,
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const rawFocusNode =
      Array.from(projection.allNodesMap.values()).find(
        (node) => node.slug === focusSlug,
      ) ?? projection.directNodes[0] ?? null;

    if (!rawFocusNode) {
      return {
        requestedFocusSlug: focusSlug ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focusSlug ? false : true,
        rootPath: [],
        focus: null,
        primaryFlow: null,
        detailPanels: [],
        hotNodes,
        nodeCount: projection.directNodes.length,
        lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
      };
    }

    const includePrivate = this.canAccessPrivateBlog(blog, viewer);
    const displayFocusNode = this.getDisplayNode(rawFocusNode, rootFamilies);
    const pathFromRoot = this.buildDisplayPathFromRoot(
      rawFocusNode,
      projection.allNodesMap,
      rootFamilies,
    );
    const focusNodeIds = this.getDisplayNodeRawIds(displayFocusNode, rootFamilies);
    const childNodes = this.sortVisibleNodes(
      this.getDisplayChildren(displayFocusNode, projection, rootFamilies),
      aggregatePostCounts,
    );
    const relationGroups = await this.buildFlowBoardRelationGroups({
      blog,
      focusNode: displayFocusNode,
      projection,
      rootFamilies,
      aggregateCounts: aggregatePostCounts,
      includePrivate,
      limit: Math.min(Math.max(limit, 8), 28),
    });

    const primaryFlowSource =
      childNodes.length > 0
        ? {
            id: "primary-children",
            title: "핵심 구조",
            kind: "child" as const,
            items: childNodes,
          }
        : relationGroups.followups.length > 0
          ? {
              id: "primary-followups",
              title: "다음으로 이어지는 흐름",
              kind: "followup" as const,
              items: relationGroups.followups,
            }
          : relationGroups.prerequisites.length > 0
            ? {
                id: "primary-prerequisites",
                title: "먼저 읽으면 좋은 흐름",
                kind: "prerequisite" as const,
                items: relationGroups.prerequisites,
              }
            : relationGroups.duplicates.length > 0
              ? {
                  id: "primary-duplicates",
                  title: "같이 보면 좋은 관점",
                  kind: "duplicate" as const,
                  items: relationGroups.duplicates,
                }
              : null;

    const primaryFlowNodes = primaryFlowSource?.items.slice(0, 4) ?? [];
    const primaryFlowItems = primaryFlowNodes.map((node) =>
      this.toFlowBoardItem(
        node,
        primaryFlowSource?.kind ?? "child",
        aggregatePostCounts,
        rootFamilies,
      ),
    );
    const primaryFlowNodeIds = new Set(primaryFlowItems.map((item) => item.slug));
    const primaryFlowEvidencePosts = primaryFlowSource
      ? await this.getEvidencePostsForVisibleNodes(
          blog,
          primaryFlowNodes,
          rootFamilies,
          includePrivate,
          3,
        )
      : [];

    const detailPanelDrafts = this.buildFlowBoardPanels({
      pathFromRoot,
      childNodes,
      relationGroups,
      aggregateCounts: aggregatePostCounts,
      rootFamilies,
      primaryFlowNodeIds,
    });
    const detailPanels = (
      await Promise.all(
        detailPanelDrafts.map(async (panelDraft) => {
          const evidencePosts = await this.getEvidencePostsForVisibleNodes(
            blog,
            panelDraft.items,
            rootFamilies,
            includePrivate,
            3,
          );

          if (evidencePosts.length === 0) {
            return null;
          }

          return {
            id: panelDraft.id,
            title: panelDraft.title,
            layoutHint: panelDraft.layoutHint,
            items: panelDraft.items.map((node) =>
              this.toFlowBoardItem(
                node,
                panelDraft.kind,
                aggregatePostCounts,
                rootFamilies,
              ),
            ),
            evidencePosts,
          };
        }),
      )
    )
      .filter((panel): panel is FlowBoardPanel => Boolean(panel))
      .slice(0, 3);

    return {
      requestedFocusSlug: focusSlug ?? null,
      resolvedFocusSlug: displayFocusNode.slug,
      requestedFocusFound: focusSlug ? rawFocusNode.slug === focusSlug : true,
      rootPath: pathFromRoot.map((node) =>
        this.toFlowBoardItem(node, "path", aggregatePostCounts, rootFamilies),
      ),
      focus: this.toFlowBoardItem(
        displayFocusNode,
        "focus",
        aggregatePostCounts,
        rootFamilies,
      ),
      primaryFlow: primaryFlowSource
        ? {
            id: primaryFlowSource.id,
            title: primaryFlowSource.title,
            items: primaryFlowItems,
            evidencePosts: primaryFlowEvidencePosts,
          }
        : null,
      detailPanels,
      hotNodes,
      nodeCount: projection.directNodes.length,
      lastUpdatedAt: this.getLastUpdatedAt(projection.directNodes),
    };
  }

  async readBlogNodeDetail(blog: Blog, nodeSlug: string, viewer?: User) {
    const projection = await this.getBlogNodeProjection(blog, viewer);
    const aggregatePostCounts = this.buildAggregatePostCountMap(projection);
    const rootFamilies = this.buildRootFamilyProjection(
      projection,
      aggregatePostCounts,
    );
    const node = Array.from(projection.allNodesMap.values()).find(
      (item) => item.slug === nodeSlug,
    );

    if (!node) {
      throw new NotFoundException("Knowledge node not found");
    }

    const includePrivate = this.canAccessPrivateBlog(blog, viewer);
    const rootFamily =
      !node.parentNodeId
        ? rootFamilies.familyByMemberId.get(node.id) ?? null
        : null;
    const familyNodeIds = rootFamily
      ? rootFamily.members.map((member) => member.id)
      : [node.id];
    const displayNode = rootFamily?.representative ?? node;

    const [posts, relatedNodes, followups] = await Promise.all([
      this.getLinkedPostsForNodes(blog, familyNodeIds, includePrivate),
      this.getRelatedNodesForBlog(blog.userId, familyNodeIds, projection),
      includePrivate
        ? this.knowledgeFollowupRepository.find({
            where: {
              userId: blog.userId,
              nodeId: In(familyNodeIds),
              status: "pending",
            },
            order: { updatedAt: "DESC" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    const childNodes = (
      rootFamily?.displayChildren ?? projection.childrenMap.get(node.id) ?? []
    ).map((child) => ({
      slug: child.slug,
      title: child.title,
      canonicalPath: child.canonicalPath,
      summary: child.summary,
      postCount: aggregatePostCounts.get(child.id) ?? child.postCount,
      evidenceCount: child.evidenceCount,
    }));

    return {
      node: {
        slug: displayNode.slug,
        title: displayNode.title,
        summary: displayNode.summary,
        canonicalPath: displayNode.canonicalPath,
        nodeType: displayNode.nodeType,
        postCount: rootFamily
          ? this.getFamilyAggregatePostCount(rootFamily, aggregatePostCounts)
          : aggregatePostCounts.get(node.id) ?? node.postCount,
        evidenceCount: rootFamily
          ? this.getFamilyEvidenceCount(rootFamily)
          : node.evidenceCount,
      },
      breadcrumb: this.buildBreadcrumb(displayNode, projection.allNodesMap),
      posts,
      relatedNodes,
      childNodes,
      followups: followups.map((followup) => ({
        id: followup.id,
        title: followup.title,
        reason: followup.reason,
      })),
    };
  }

  async getTrendingNodes(limit = 5) {
    const safeLimit = Math.min(Math.max(limit, 1), 10);

    const rows = await this.postKnowledgeLinkRepository
      .createQueryBuilder("link")
      .innerJoin(KnowledgeNode, "node", "node.id = link.nodeId")
      .innerJoin(Post, "post", "post.id = link.postId")
      .innerJoin(Blog, "blog", "blog.id = post.blogId")
      .select("node.id", "nodeId")
      .addSelect("node.slug", "slug")
      .addSelect("node.title", "title")
      .addSelect("node.canonicalPath", "canonicalPath")
      .addSelect("node.summary", "summary")
      .addSelect("node.evidenceCount", "evidenceCount")
      .addSelect("blog.slug", "blogSlug")
      .addSelect("blog.alias", "blogAlias")
      .addSelect("blog.name", "blogName")
      .addSelect("CAST(COUNT(DISTINCT post.id) AS INT)", "postCount")
      .where("node.status = :status", { status: "active" })
      .andWhere("blog.isPublic = true")
      .andWhere("post.isDeleted = false")
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :publishedStatus", { publishedStatus: "published" })
      .andWhere("post.visibility = :visibility", { visibility: "public" })
      .groupBy("node.id")
      .addGroupBy("blog.slug")
      .addGroupBy("blog.alias")
      .addGroupBy("blog.name")
      .orderBy("CAST(COUNT(DISTINCT post.id) AS INT)", "DESC")
      .addOrderBy("node.evidenceCount", "DESC")
      .addOrderBy("MAX(link.updatedAt)", "DESC")
      .limit(safeLimit)
      .getRawMany<{
        nodeId: string;
        slug: string;
        title: string;
        canonicalPath: string;
        summary: string | null;
        evidenceCount: string | number;
        blogSlug: string;
        blogAlias: string | null;
        blogName: string;
        postCount: string | number;
      }>();

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      canonicalPath: row.canonicalPath,
      summary: row.summary,
      evidenceCount: Number(row.evidenceCount ?? 0),
      postCount: Number(row.postCount ?? 0),
      blog: {
        slug: row.blogSlug,
        alias: row.blogAlias,
        name: row.blogName,
      },
    }));
  }

  async getPostKnowledgeContext(postId: string, viewer?: User) {
    const startedAt = Date.now();
    let lastMarkAt = startedAt;
    const stepDurations: string[] = [];
    const markStep = (label: string) => {
      const now = Date.now();
      stepDurations.push(`${label}=${now - lastMarkAt}ms`);
      lastMarkAt = now;
    };
    const logCompletion = (extra: {
      linkCount: number;
      primaryCount: number;
      secondaryCount: number;
      relatedCount: number;
    }) => {
      const totalMs = Date.now() - startedAt;
      const message =
        `[KNOWLEDGE_CONTEXT_TIMING] postId=${postId} blogId=${post?.blog?.id ?? "unknown"} ` +
        `links=${extra.linkCount} primary=${extra.primaryCount} secondary=${extra.secondaryCount} related=${extra.relatedCount} ` +
        `total=${totalMs}ms steps=${stepDurations.join(" ")}`;

      if (totalMs >= 750) {
        this.logger.warn(message);
        return;
      }

      this.logger.debug(message);
    };

    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["blog"],
    });
    markStep("post_lookup");

    if (!post?.blog) {
      throw new NotFoundException("Post not found");
    }

    if (!this.canAccessPost(post, post.blog, viewer)) {
      throw new NotFoundException("Post not found");
    }

    const links = await this.postKnowledgeLinkRepository
      .createQueryBuilder("link")
      .innerJoin(KnowledgeNode, "node", "node.id = link.nodeId")
      .select("link.role", "role")
      .addSelect("node.id", "id")
      .addSelect("node.slug", "slug")
      .addSelect("node.title", "title")
      .addSelect("node.canonicalPath", "canonicalPath")
      .addSelect("node.summary", "summary")
      .where("link.postId = :postId", { postId })
      .andWhere("link.userId = :userId", { userId: post.blog.userId })
      .andWhere("node.status = :status", { status: "active" })
      .orderBy(
        "CASE WHEN link.role = 'primary' THEN 0 WHEN link.role = 'secondary' THEN 1 ELSE 2 END",
        "ASC",
      )
      .addOrderBy("node.title", "ASC")
      .getRawMany<{
        role: string;
        id: string;
        slug: string;
        title: string;
        canonicalPath: string;
        summary: string | null;
      }>();
    markStep("link_lookup");

    if (links.length === 0) {
      logCompletion({
        linkCount: 0,
        primaryCount: 0,
        secondaryCount: 0,
        relatedCount: 0,
      });
      return {
        breadcrumb: [],
        canonicalPath: null,
        primaryNodes: [],
        secondaryNodes: [],
        relatedNodes: [],
      };
    }

    const linkedNodeIds = Array.from(new Set(links.map((item) => item.id)));
    let contextProjection = await this.buildPostKnowledgeContextProjection(
      post.blog,
      viewer,
      linkedNodeIds,
    );
    markStep("context_projection");

    const toDisplayNode = (item: {
      id: string;
      slug: string;
      title: string;
      canonicalPath: string;
      summary: string | null;
    }): VisibleNodeRow => {
      const existingNode = contextProjection.allNodesMap.get(item.id);
      if (existingNode) {
        return this.getPostContextDisplayNode(existingNode, contextProjection);
      }

      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        canonicalPath: item.canonicalPath,
        summary: item.summary,
        nodeType: "topic",
        parentNodeId: null,
        evidenceCount: 0,
        postCount: 0,
        updatedAt: null,
      };
    };
    const dedupeNodeSummaries = <
      T extends {
        slug: string;
      },
    >(
      items: T[],
    ) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        if (seen.has(item.slug)) {
          return false;
        }
        seen.add(item.slug);
        return true;
      });
    };
    const primaryNodes = links
      .filter((item) => item.role === "primary")
      .map((item) => toDisplayNode(item))
      .map((item) => ({
        slug: item.slug,
        title: item.title,
        canonicalPath: item.canonicalPath,
        summary: item.summary,
      }));
    const secondaryNodes = links
      .filter((item) => item.role !== "primary")
      .map((item) => toDisplayNode(item))
      .map((item) => ({
        slug: item.slug,
        title: item.title,
        canonicalPath: item.canonicalPath,
        summary: item.summary,
      }));

    const firstPrimary = links.find((item) => item.role === "primary") ?? links[0];
    const breadcrumbNode = firstPrimary
      ? contextProjection.allNodesMap.get(firstPrimary.id)
      : undefined;
    const breadcrumbSource = breadcrumbNode
      ? this.getPostContextDisplayNode(breadcrumbNode, contextProjection)
      : firstPrimary
        ? toDisplayNode(firstPrimary)
        : undefined;
    const relatedNodeIds = firstPrimary
      ? (
          breadcrumbNode
            ? this.getPostContextNodeRawIds(breadcrumbNode, contextProjection)
            : [firstPrimary.id]
        )
      : [];
    const relatedEdges =
      relatedNodeIds.length > 0
        ? await this.getRelatedContextEdges(post.blog.userId, relatedNodeIds)
        : [];
    markStep("related_edges");

    const relatedOtherNodeIds = Array.from(
      new Set(
        relatedEdges
          .map((edge) =>
            relatedNodeIds.includes(edge.fromNodeId)
              ? edge.toNodeId
              : edge.fromNodeId,
          )
          .filter(Boolean),
      ),
    );
    if (
      relatedOtherNodeIds.some((nodeId) => !contextProjection.allNodesMap.has(nodeId))
    ) {
      contextProjection = await this.buildPostKnowledgeContextProjection(
        post.blog,
        viewer,
        [...linkedNodeIds, ...relatedOtherNodeIds],
      );
      markStep("context_projection_expand");
    }

    const relatedNodes = this.buildRelatedNodesFromContextEdges(
      relatedEdges,
      relatedNodeIds,
      contextProjection,
    );
    markStep("related_nodes");

    const result = {
      breadcrumb: breadcrumbSource
        ? this.buildBreadcrumb(breadcrumbSource, contextProjection.allNodesMap)
        : [],
      canonicalPath: breadcrumbSource?.canonicalPath ?? null,
      primaryNodes: dedupeNodeSummaries(primaryNodes),
      secondaryNodes: dedupeNodeSummaries(secondaryNodes),
      relatedNodes,
    };
    logCompletion({
      linkCount: links.length,
      primaryCount: result.primaryNodes.length,
      secondaryCount: result.secondaryNodes.length,
      relatedCount: result.relatedNodes.length,
    });

    return result;
  }

  private async getBlogNodeProjection(
    blog: Blog,
    viewer?: User,
  ): Promise<BlogNodeProjection> {
    const includePrivate = this.canAccessPrivateBlog(blog, viewer);
    const directNodes = await this.getVisibleNodeRowsForBlog(
      blog.id,
      blog.userId,
      includePrivate,
    );

    const allNodesMap = new Map<string, VisibleNodeRow>();
    for (const node of directNodes) {
      allNodesMap.set(node.id, node);
    }

    let pendingParentIds = Array.from(
      new Set(
        directNodes
          .map((node) => node.parentNodeId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    while (pendingParentIds.length > 0) {
      const missingParentIds = pendingParentIds.filter(
        (id) => !allNodesMap.has(id),
      );
      if (missingParentIds.length === 0) {
        break;
      }

      const parentNodes = await this.knowledgeNodeRepository.find({
        where: {
          userId: blog.userId,
          id: In(missingParentIds),
          status: "active",
        },
      });

      if (parentNodes.length === 0) {
        break;
      }

      for (const parent of parentNodes) {
        allNodesMap.set(parent.id, {
          id: parent.id,
          slug: parent.slug,
          title: parent.title,
          canonicalPath: parent.canonicalPath,
          summary: parent.summary,
          nodeType: parent.nodeType,
          parentNodeId: parent.parentNodeId,
          evidenceCount: parent.evidenceCount,
          postCount: 0,
          updatedAt: parent.updatedAt ?? null,
        });
      }

      pendingParentIds = parentNodes
        .map((node) => node.parentNodeId)
        .filter((value): value is string => Boolean(value));
    }

    const childrenMap = new Map<string | null, VisibleNodeRow[]>();
    for (const node of allNodesMap.values()) {
      const key = node.parentNodeId ?? null;
      const existing = childrenMap.get(key) ?? [];
      existing.push(node);
      childrenMap.set(key, existing);
    }

    for (const children of childrenMap.values()) {
      children.sort((left, right) => {
        if (right.postCount !== left.postCount) {
          return right.postCount - left.postCount;
        }
        if (right.evidenceCount !== left.evidenceCount) {
          return right.evidenceCount - left.evidenceCount;
        }
        return left.title.localeCompare(right.title, "ko");
      });
    }

    return {
      directNodes,
      allNodesMap,
      childrenMap,
      directNodeIds: new Set(directNodes.map((node) => node.id)),
    };
  }

  private async getVisibleNodeRowsForBlog(
    blogId: string,
    userId: string,
    includePrivate: boolean,
  ): Promise<VisibleNodeRow[]> {
    const query = this.postKnowledgeLinkRepository
      .createQueryBuilder("link")
      .innerJoin(KnowledgeNode, "node", "node.id = link.nodeId")
      .innerJoin(Post, "post", "post.id = link.postId")
      .select("node.id", "id")
      .addSelect("node.slug", "slug")
      .addSelect("node.title", "title")
      .addSelect("node.canonicalPath", "canonicalPath")
      .addSelect("node.summary", "summary")
      .addSelect("node.nodeType", "nodeType")
      .addSelect("node.parentNodeId", "parentNodeId")
      .addSelect("node.evidenceCount", "evidenceCount")
      .addSelect("node.updatedAt", "updatedAt")
      .addSelect("CAST(COUNT(DISTINCT post.id) AS INT)", "postCount")
      .where("link.userId = :userId", { userId })
      .andWhere("post.blogId = :blogId", { blogId })
      .andWhere("node.status = :status", { status: "active" })
      .andWhere("post.isDeleted = false")
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :publishedStatus", { publishedStatus: "published" });

    if (!includePrivate) {
      query.andWhere("post.visibility = :visibility", { visibility: "public" });
    }

    const rows = await query
      .groupBy("node.id")
      .orderBy("CAST(COUNT(DISTINCT post.id) AS INT)", "DESC")
      .addOrderBy("node.evidenceCount", "DESC")
      .getRawMany<{
        id: string;
        slug: string;
        title: string;
        canonicalPath: string;
        summary: string | null;
        nodeType: string;
        parentNodeId: string | null;
        evidenceCount: string | number;
        postCount: string | number;
        updatedAt: Date | string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      canonicalPath: row.canonicalPath,
      summary: row.summary,
      nodeType: row.nodeType,
      parentNodeId: row.parentNodeId,
      evidenceCount: Number(row.evidenceCount ?? 0),
      postCount: Number(row.postCount ?? 0),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
  }

  private async getVisibleNodeRowsByIds(
    blogId: string,
    userId: string,
    includePrivate: boolean,
    nodeIds: string[],
  ): Promise<VisibleNodeRow[]> {
    const dedupedNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    if (dedupedNodeIds.length === 0) {
      return [];
    }

    const query = this.postKnowledgeLinkRepository
      .createQueryBuilder("link")
      .innerJoin(KnowledgeNode, "node", "node.id = link.nodeId")
      .innerJoin(Post, "post", "post.id = link.postId")
      .select("node.id", "id")
      .addSelect("node.slug", "slug")
      .addSelect("node.title", "title")
      .addSelect("node.canonicalPath", "canonicalPath")
      .addSelect("node.summary", "summary")
      .addSelect("node.nodeType", "nodeType")
      .addSelect("node.parentNodeId", "parentNodeId")
      .addSelect("node.evidenceCount", "evidenceCount")
      .addSelect("node.updatedAt", "updatedAt")
      .addSelect("CAST(COUNT(DISTINCT post.id) AS INT)", "postCount")
      .where("link.userId = :userId", { userId })
      .andWhere("post.blogId = :blogId", { blogId })
      .andWhere("node.id IN (:...nodeIds)", { nodeIds: dedupedNodeIds })
      .andWhere("node.status = :status", { status: "active" })
      .andWhere("post.isDeleted = false")
      .andWhere("post.isPublished = true")
      .andWhere("post.status = :publishedStatus", { publishedStatus: "published" });

    if (!includePrivate) {
      query.andWhere("post.visibility = :visibility", { visibility: "public" });
    }

    const rows = await query
      .groupBy("node.id")
      .orderBy("CAST(COUNT(DISTINCT post.id) AS INT)", "DESC")
      .addOrderBy("node.evidenceCount", "DESC")
      .getRawMany<{
        id: string;
        slug: string;
        title: string;
        canonicalPath: string;
        summary: string | null;
        nodeType: string;
        parentNodeId: string | null;
        evidenceCount: string | number;
        postCount: string | number;
        updatedAt: Date | string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      canonicalPath: row.canonicalPath,
      summary: row.summary,
      nodeType: row.nodeType,
      parentNodeId: row.parentNodeId,
      evidenceCount: Number(row.evidenceCount ?? 0),
      postCount: Number(row.postCount ?? 0),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
  }

  private async buildPostKnowledgeContextProjection(
    blog: Blog,
    viewer: User | undefined,
    seedNodeIds: string[],
  ): Promise<PostKnowledgeContextProjection> {
    const includePrivate = this.canAccessPrivateBlog(blog, viewer);
    const directNodes = await this.getVisibleNodeRowsByIds(
      blog.id,
      blog.userId,
      includePrivate,
      seedNodeIds,
    );
    const allNodesMap = new Map<string, VisibleNodeRow>(
      directNodes.map((node) => [node.id, node]),
    );

    let pendingParentIds = Array.from(
      new Set(
        directNodes
          .map((node) => node.parentNodeId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    while (pendingParentIds.length > 0) {
      const missingParentIds = pendingParentIds.filter(
        (id) => !allNodesMap.has(id),
      );
      if (missingParentIds.length === 0) {
        break;
      }

      const parentNodes = await this.knowledgeNodeRepository.find({
        where: {
          userId: blog.userId,
          id: In(missingParentIds),
          status: "active",
        },
      });

      if (parentNodes.length === 0) {
        break;
      }

      for (const parent of parentNodes) {
        allNodesMap.set(parent.id, {
          id: parent.id,
          slug: parent.slug,
          title: parent.title,
          canonicalPath: parent.canonicalPath,
          summary: parent.summary,
          nodeType: parent.nodeType,
          parentNodeId: parent.parentNodeId,
          evidenceCount: parent.evidenceCount,
          postCount: 0,
          updatedAt: parent.updatedAt ?? null,
        });
      }

      pendingParentIds = parentNodes
        .map((node) => node.parentNodeId)
        .filter((value): value is string => Boolean(value));
    }

    const visibleRootFamilyRows = await this.getVisibleRootFamilyRows(
      blog,
      includePrivate,
      Array.from(allNodesMap.values()),
    );
    for (const rootNode of visibleRootFamilyRows) {
      allNodesMap.set(rootNode.id, rootNode);
    }

    return {
      allNodesMap,
      rootFamilyByMemberId: this.buildPostContextRootFamilies(allNodesMap),
    };
  }

  private async getVisibleRootFamilyRows(
    blog: Blog,
    includePrivate: boolean,
    nodes: VisibleNodeRow[],
  ) {
    const rootFamilySlugs = Array.from(
      new Set(
        nodes
          .filter((node) => !node.parentNodeId)
          .map((node) => getKnowledgeNodeCanonicalRoot(node).slug)
          .filter(Boolean),
      ),
    );

    if (rootFamilySlugs.length === 0) {
      return [];
    }

    const rootNodes = await this.knowledgeNodeRepository.find({
      where: {
        userId: blog.userId,
        status: "active",
        parentNodeId: IsNull(),
      },
    });

    const matchedRoots = rootNodes.filter((node) =>
      rootFamilySlugs.includes(getKnowledgeNodeCanonicalRoot(node).slug),
    );
    if (matchedRoots.length === 0) {
      return [];
    }

    const visibleRootRows = await this.getVisibleNodeRowsByIds(
      blog.id,
      blog.userId,
      includePrivate,
      matchedRoots.map((node) => node.id),
    );
    const visibleRootMap = new Map(
      visibleRootRows.map((row) => [row.id, row]),
    );

    return matchedRoots.map((node) => {
      const visible = visibleRootMap.get(node.id);
      if (visible) {
        return visible;
      }

      return {
        id: node.id,
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        nodeType: node.nodeType,
        parentNodeId: node.parentNodeId,
        evidenceCount: node.evidenceCount,
        postCount: 0,
        updatedAt: node.updatedAt ?? null,
      } satisfies VisibleNodeRow;
    });
  }

  private buildPostContextRootFamilies(
    allNodesMap: Map<string, VisibleNodeRow>,
  ) {
    const roots = Array.from(allNodesMap.values()).filter(
      (node) => !node.parentNodeId,
    );
    const groups = new Map<string, VisibleNodeRow[]>();

    for (const rootNode of roots) {
      const key = getKnowledgeNodeCanonicalRoot(rootNode).slug;
      const existing = groups.get(key) ?? [];
      existing.push(rootNode);
      groups.set(key, existing);
    }

    const familyByMemberId = new Map<string, ContextRootFamily>();
    for (const members of groups.values()) {
      const directCounts = new Map(
        members.map((member) => [member.id, member.postCount]),
      );
      const sortedMembers = members
        .slice()
        .sort((left, right) =>
          this.compareRootRepresentativePriority(left, right, directCounts),
        );
      const family: ContextRootFamily = {
        representative: sortedMembers[0],
        members: sortedMembers,
      };

      for (const member of sortedMembers) {
        familyByMemberId.set(member.id, family);
      }
    }

    return familyByMemberId;
  }

  private getPostContextDisplayNode(
    node: VisibleNodeRow,
    projection: PostKnowledgeContextProjection,
  ) {
    return projection.rootFamilyByMemberId.get(node.id)?.representative ?? node;
  }

  private getPostContextNodeRawIds(
    node: VisibleNodeRow,
    projection: PostKnowledgeContextProjection,
  ) {
    return (
      projection.rootFamilyByMemberId.get(node.id)?.members.map(
        (member) => member.id,
      ) ?? [node.id]
    );
  }

  private async getRelatedContextEdges(userId: string, nodeIds: string[]) {
    const dedupedNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    if (dedupedNodeIds.length === 0) {
      return [];
    }

    return this.knowledgeEdgeRepository.find({
      where: [
        {
          userId,
          fromNodeId: In(dedupedNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
        {
          userId,
          toNodeId: In(dedupedNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
      ],
      order: { evidenceCount: "DESC", updatedAt: "DESC" },
      take: 8,
    });
  }

  private buildRelatedNodesFromContextEdges(
    edges: KnowledgeEdge[],
    sourceNodeIds: string[],
    projection: PostKnowledgeContextProjection,
  ) {
    const sourceNodeIdSet = new Set(sourceNodeIds);
    const related = edges
      .map((edge) => {
        const otherNodeId = sourceNodeIdSet.has(edge.fromNodeId)
          ? edge.toNodeId
          : edge.fromNodeId;
        const otherNode = projection.allNodesMap.get(otherNodeId);
        if (!otherNode) {
          return null;
        }

        const displayNode = this.getPostContextDisplayNode(otherNode, projection);
        return {
          slug: displayNode.slug,
          title: displayNode.title,
          canonicalPath: displayNode.canonicalPath,
          summary: displayNode.summary,
          relationType: edge.relationType,
          evidenceCount: displayNode.evidenceCount,
          postCount: displayNode.postCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const seen = new Set<string>();
    return related.filter((item) => {
      if (seen.has(item.slug)) {
        return false;
      }
      seen.add(item.slug);
      return true;
    });
  }

  private buildTree(
    projection: BlogNodeProjection,
    aggregateCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
  ) {
    const rootNodes = rootFamilies.families.map((family) => family.representative);

    const buildNode = (
      node: VisibleNodeRow,
      lineage = new Set<string>(),
    ) => {
      if (lineage.has(node.id)) {
        this.logger.warn(
          `[KNOWLEDGE_TREE_CYCLE] context=buildTree nodeId=${node.id} slug=${node.slug}`,
        );
        return {
          slug: node.slug,
          title: node.title,
          canonicalPath: node.canonicalPath,
          summary: node.summary,
          postCount: aggregateCounts.get(node.id) ?? node.postCount,
          evidenceCount: node.evidenceCount,
          children: [],
        };
      }

      const nextLineage = new Set(lineage);
      nextLineage.add(node.id);

      return {
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        postCount: aggregateCounts.get(node.id) ?? node.postCount,
        evidenceCount: node.evidenceCount,
        children: (projection.childrenMap.get(node.id) ?? []).map((child) =>
          buildNode(child, nextLineage),
        ),
      };
    };

    return rootNodes.map((rootNode) => {
      const family = rootFamilies.familyByRepresentativeId.get(rootNode.id);
      if (!family) {
        return buildNode(rootNode);
      }

      return {
        slug: rootNode.slug,
        title: rootNode.title,
        canonicalPath: rootNode.canonicalPath,
        summary: rootNode.summary,
        postCount: this.getFamilyAggregatePostCount(family, aggregateCounts),
        evidenceCount: this.getFamilyEvidenceCount(family),
        children: family.displayChildren.map((child) => buildNode(child)),
      };
    });
  }

  private getRankedDirectNodes(projection: BlogNodeProjection) {
    return projection.directNodes.slice().sort((left, right) => {
      if (right.postCount !== left.postCount) {
        return right.postCount - left.postCount;
      }
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.title.localeCompare(right.title, "ko");
    });
  }

  private getDisplayNode(
    node: VisibleNodeRow,
    rootFamilies: RootFamilyProjection,
  ) {
    return rootFamilies.familyByMemberId.get(node.id)?.representative ?? node;
  }

  private getDisplayPostCount(
    node: VisibleNodeRow,
    aggregateCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
  ) {
    const family = rootFamilies.familyByMemberId.get(node.id);
    if (family) {
      return this.getFamilyAggregatePostCount(family, aggregateCounts);
    }
    return aggregateCounts.get(node.id) ?? node.postCount;
  }

  private getDisplayEvidenceCount(
    node: VisibleNodeRow,
    rootFamilies: RootFamilyProjection,
  ) {
    const family = rootFamilies.familyByMemberId.get(node.id);
    if (family) {
      return this.getFamilyEvidenceCount(family);
    }
    return node.evidenceCount;
  }

  private toKnowledgeMapNode(
    node: VisibleNodeRow,
    aggregatePostCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
    isFocus: boolean,
  ) {
    return {
      slug: node.slug,
      title: node.title,
      canonicalPath: node.canonicalPath,
      summary: node.summary,
      nodeType: node.nodeType,
      postCount: this.getDisplayPostCount(
        node,
        aggregatePostCounts,
        rootFamilies,
      ),
      evidenceCount: this.getDisplayEvidenceCount(node, rootFamilies),
      isFocus,
    };
  }

  private toKnowledgeMapFocusNode(
    node: VisibleNodeRow,
    aggregatePostCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
  ) {
    return {
      slug: node.slug,
      title: node.title,
      canonicalPath: node.canonicalPath,
      summary: node.summary,
      nodeType: node.nodeType,
      postCount: this.getDisplayPostCount(
        node,
        aggregatePostCounts,
        rootFamilies,
      ),
      evidenceCount: this.getDisplayEvidenceCount(node, rootFamilies),
    };
  }

  private toKnowledgeCanvasNode(
    node: VisibleNodeRow,
    aggregatePostCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
    depth: number,
    isOnFocusPath: boolean,
  ) {
    return {
      slug: node.slug,
      title: node.title,
      canonicalPath: node.canonicalPath,
      summary: node.summary,
      nodeType: node.nodeType,
      postCount: this.getDisplayPostCount(
        node,
        aggregatePostCounts,
        rootFamilies,
      ),
      evidenceCount: this.getDisplayEvidenceCount(node, rootFamilies),
      depth,
      isOnFocusPath,
    };
  }

  private toFlowBoardItem(
    node: VisibleNodeRow,
    kind: FlowBoardItemKind,
    aggregatePostCounts: Map<string, number>,
    rootFamilies: RootFamilyProjection,
  ): FlowBoardItem {
    return {
      slug: node.slug,
      title: node.title,
      canonicalPath: node.canonicalPath,
      summary: node.summary,
      nodeType: node.nodeType,
      postCount: this.getDisplayPostCount(
        node,
        aggregatePostCounts,
        rootFamilies,
      ),
      evidenceCount: this.getDisplayEvidenceCount(node, rootFamilies),
      kind,
    };
  }

  private buildDisplayPathFromRoot(
    rawFocusNode: VisibleNodeRow,
    allNodesMap: Map<string, VisibleNodeRow>,
    rootFamilies: RootFamilyProjection,
  ) {
    const lineage: VisibleNodeRow[] = [];
    let current: VisibleNodeRow | undefined = rawFocusNode;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current.id)) {
        this.logger.warn(
          `[KNOWLEDGE_TREE_CYCLE] context=buildDisplayPathFromRoot nodeId=${current.id} slug=${current.slug}`,
        );
        break;
      }
      visited.add(current.id);
      lineage.unshift(current);
      current = current.parentNodeId
        ? allNodesMap.get(current.parentNodeId)
        : undefined;
    }

    const deduped: VisibleNodeRow[] = [];
    const seen = new Set<string>();
    for (const rawNode of lineage) {
      const displayNode = this.getDisplayNode(rawNode, rootFamilies);
      if (seen.has(displayNode.id)) {
        continue;
      }
      seen.add(displayNode.id);
      deduped.push(displayNode);
    }

    return deduped;
  }

  private getDisplayChildren(
    node: VisibleNodeRow,
    projection: BlogNodeProjection,
    rootFamilies: RootFamilyProjection,
  ) {
    const rootFamily = rootFamilies.familyByRepresentativeId.get(node.id);
    if (rootFamily) {
      return rootFamily.displayChildren;
    }

    return projection.childrenMap.get(node.id) ?? [];
  }

  private getDisplayNodeRawIds(
    node: VisibleNodeRow,
    rootFamilies: RootFamilyProjection,
  ) {
    const rootFamily =
      rootFamilies.familyByRepresentativeId.get(node.id) ??
      rootFamilies.familyByMemberId.get(node.id);

    if (!rootFamily) {
      return [node.id];
    }

    return rootFamily.members.map((member) => member.id);
  }

  private buildCanvasDisplayNodes({
    rootNode,
    pathFromRoot,
    projection,
    aggregateCounts,
    rootFamilies,
    limit,
  }: {
    rootNode: VisibleNodeRow;
    pathFromRoot: VisibleNodeRow[];
    projection: BlogNodeProjection;
    aggregateCounts: Map<string, number>;
    rootFamilies: RootFamilyProjection;
    limit: number;
  }): CanvasDisplayNode[] {
    const focusPathIds = new Set(pathFromRoot.map((node) => node.id));
    const nodes = new Map<string, CanvasDisplayNode>();
    const visited = new Set<string>();

    const enqueueChildren = (
      queue: Array<{ node: VisibleNodeRow; depth: number }>,
      parent: VisibleNodeRow,
      depth: number,
    ) => {
      const children = this.getDisplayChildren(parent, projection, rootFamilies);
      if (children.length === 0) {
        return;
      }

      const prioritized = this.sortVisibleNodes(children, aggregateCounts).sort(
        (left, right) => {
          const leftOnPath = focusPathIds.has(left.id) ? 1 : 0;
          const rightOnPath = focusPathIds.has(right.id) ? 1 : 0;
          if (rightOnPath !== leftOnPath) {
            return rightOnPath - leftOnPath;
          }
          return 0;
        },
      );

      for (const child of prioritized) {
        queue.push({ node: child, depth });
      }
    };

    const queue: Array<{ node: VisibleNodeRow; depth: number }> = [
      { node: rootNode, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      if (visited.has(current.node.id)) {
        continue;
      }
      visited.add(current.node.id);

      const isOnFocusPath = focusPathIds.has(current.node.id);
      if (nodes.size < limit || isOnFocusPath) {
        nodes.set(current.node.id, {
          ...current.node,
          depth: current.depth,
          isOnFocusPath,
        });
        enqueueChildren(queue, current.node, current.depth + 1);
      }
    }

    for (const [index, node] of pathFromRoot.entries()) {
      if (!nodes.has(node.id)) {
        nodes.set(node.id, {
          ...node,
          depth: index,
          isOnFocusPath: true,
        });
      }
    }

    return Array.from(nodes.values()).sort((left, right) => {
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }
      if (left.isOnFocusPath !== right.isOnFocusPath) {
        return left.isOnFocusPath ? -1 : 1;
      }
      const rightPostCount = this.getDisplayPostCount(
        right,
        aggregateCounts,
        rootFamilies,
      );
      const leftPostCount = this.getDisplayPostCount(
        left,
        aggregateCounts,
        rootFamilies,
      );
      if (rightPostCount !== leftPostCount) {
        return rightPostCount - leftPostCount;
      }
      const rightEvidenceCount = this.getDisplayEvidenceCount(right, rootFamilies);
      const leftEvidenceCount = this.getDisplayEvidenceCount(left, rootFamilies);
      if (rightEvidenceCount !== leftEvidenceCount) {
        return rightEvidenceCount - leftEvidenceCount;
      }
      return left.title.localeCompare(right.title, "ko");
    });
  }

  private buildCanvasTreeEdges(
    rootNode: VisibleNodeRow,
    projection: BlogNodeProjection,
    rootFamilies: RootFamilyProjection,
    includedNodeMap: Map<string, CanvasDisplayNode>,
  ) {
    const edges: Array<{ fromSlug: string; toSlug: string }> = [];
    const seenEdges = new Set<string>();
    const visited = new Set<string>();
    const stack = [rootNode];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);

      for (const child of this.getDisplayChildren(
        current,
        projection,
        rootFamilies,
      )) {
        stack.push(child);

        if (!includedNodeMap.has(current.id) || !includedNodeMap.has(child.id)) {
          continue;
        }

        const edgeKey = `${current.slug}::${child.slug}`;
        if (seenEdges.has(edgeKey)) {
          continue;
        }
        seenEdges.add(edgeKey);
        edges.push({
          fromSlug: current.slug,
          toSlug: child.slug,
        });
      }
    }

    return edges;
  }

  private async buildCanvasFactEdges({
    blog,
    projection,
    rootFamilies,
    includedNodeMap,
    includePrivate,
  }: {
    blog: Blog;
    projection: BlogNodeProjection;
    rootFamilies: RootFamilyProjection;
    includedNodeMap: Map<string, CanvasDisplayNode>;
    includePrivate: boolean;
  }) {
    const rawNodeToDisplayNodeId = new Map<string, string>();
    for (const displayNode of includedNodeMap.values()) {
      for (const rawNodeId of this.getDisplayNodeRawIds(displayNode, rootFamilies)) {
        rawNodeToDisplayNodeId.set(rawNodeId, displayNode.id);
      }
    }

    const rawNodeIds = Array.from(rawNodeToDisplayNodeId.keys());
    if (rawNodeIds.length === 0) {
      return [] as CanvasFactEdgeGroup[];
    }

    let edges = await this.knowledgeEdgeRepository.find({
      where: [
        {
          userId: blog.userId,
          fromNodeId: In(rawNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
        {
          userId: blog.userId,
          toNodeId: In(rawNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
      ],
      order: {
        evidenceCount: "DESC",
        updatedAt: "DESC",
      },
    });

    if (!includePrivate && edges.length > 0) {
      const sourceIds = Array.from(
        new Set(edges.map((edge) => edge.sourceId).filter(Boolean)),
      );
      if (sourceIds.length > 0) {
        const sources = await this.knowledgeSourceRepository.find({
          where: {
            userId: blog.userId,
            id: In(sourceIds),
          },
        });
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        const visiblePostMap = await this.getPostSummaryMap(
          sources.map((source) => source.postId),
          false,
        );
        edges = edges.filter((edge) => {
          const source = sourceById.get(edge.sourceId);
          return Boolean(source && visiblePostMap.has(source.postId));
        });
      } else {
        edges = [];
      }
    }

    const grouped = new Map<string, CanvasFactEdgeGroup>();
    for (const edge of edges) {
      const fromDisplayNodeId = rawNodeToDisplayNodeId.get(edge.fromNodeId);
      const toDisplayNodeId = rawNodeToDisplayNodeId.get(edge.toNodeId);
      if (!fromDisplayNodeId || !toDisplayNodeId) {
        continue;
      }

      if (fromDisplayNodeId === toDisplayNodeId) {
        continue;
      }

      const fromNode = includedNodeMap.get(fromDisplayNodeId);
      const toNode = includedNodeMap.get(toDisplayNodeId);
      if (!fromNode || !toNode) {
        continue;
      }

      const edgeKey = `${fromNode.slug}::${edge.relationType}::${toNode.slug}`;
      const existing = grouped.get(edgeKey);
      if (existing) {
        existing.evidenceCount += edge.evidenceCount ?? 0;
        if (edge.sourceId) {
          existing.sourceIds.add(edge.sourceId);
        }
        if (existing.confidence == null && edge.confidence != null) {
          existing.confidence = edge.confidence;
        }
        if (!existing.reason && edge.reason) {
          existing.reason = edge.reason;
        }
        continue;
      }

      grouped.set(edgeKey, {
        edgeKey,
        fromSlug: fromNode.slug,
        toSlug: toNode.slug,
        relationType: edge.relationType,
        confidence: edge.confidence,
        reason: edge.reason,
        evidenceCount: edge.evidenceCount ?? 0,
        sourceIds: new Set(edge.sourceId ? [edge.sourceId] : []),
      });
    }

    return Array.from(grouped.values()).sort((left, right) => {
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.edgeKey.localeCompare(right.edgeKey, "ko");
    });
  }

  private async buildCanvasProvenance({
    blog,
    projection,
    rootFamilies,
    includedNodeMap,
    factEdges,
    includePrivate,
  }: {
    blog: Blog;
    projection: BlogNodeProjection;
    rootFamilies: RootFamilyProjection;
    includedNodeMap: Map<string, CanvasDisplayNode>;
    factEdges: CanvasFactEdgeGroup[];
    includePrivate: boolean;
  }) {
    const nodeEntries = Array.from(includedNodeMap.values());
    const nodeToRawIds = new Map<string, string[]>();
    const rawToDisplaySlug = new Map<string, string>();

    for (const node of nodeEntries) {
      const rawIds = this.getDisplayNodeRawIds(node, rootFamilies);
      nodeToRawIds.set(node.slug, rawIds);
      for (const rawId of rawIds) {
        rawToDisplaySlug.set(rawId, node.slug);
      }
    }

    const rawNodeIds = Array.from(rawToDisplaySlug.keys());
    const nodeLinks =
      rawNodeIds.length > 0
        ? await this.postKnowledgeLinkRepository.find({
            where: {
              userId: blog.userId,
              nodeId: In(rawNodeIds),
            },
            order: { updatedAt: "DESC" },
          })
        : [];

    const nodePostIds = Array.from(
      new Set(nodeLinks.map((link) => link.postId).filter(Boolean)),
    );
    const visiblePostMap = await this.getPostSummaryMap(nodePostIds, includePrivate);

    const nodePostsBySlug = new Map<string, Set<string>>();
    for (const link of nodeLinks) {
      const slug = rawToDisplaySlug.get(link.nodeId);
      if (!slug || !visiblePostMap.has(link.postId)) {
        continue;
      }
      const existing = nodePostsBySlug.get(slug) ?? new Set<string>();
      existing.add(link.postId);
      nodePostsBySlug.set(slug, existing);
    }

    const nodeProvenance = Object.fromEntries(
      Array.from(nodePostsBySlug.entries()).map(([slug, postIds]) => [
        slug,
        {
          postCount: postIds.size,
          posts: Array.from(postIds)
            .map((postId) => visiblePostMap.get(postId))
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        },
      ]),
    );

    const factSourceIds = Array.from(
      new Set(
        factEdges.flatMap((edge) => Array.from(edge.sourceIds)).filter(Boolean),
      ),
    );
    const sources =
      factSourceIds.length > 0
        ? await this.knowledgeSourceRepository.find({
            where: {
              userId: blog.userId,
              id: In(factSourceIds),
            },
            order: { updatedAt: "DESC" },
          })
        : [];
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const sourcePostMap = await this.getPostSummaryMap(
      sources.map((source) => source.postId),
      includePrivate,
    );

    return {
      nodes: nodeProvenance,
      edges: factEdges.map((edge) => {
        const posts = Array.from(edge.sourceIds)
          .map((sourceId) => sourceById.get(sourceId))
          .filter((item): item is KnowledgeSource => Boolean(item))
          .map((source) => sourcePostMap.get(source.postId))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return {
          edgeKey: edge.edgeKey,
          sourceCount: edge.sourceIds.size,
          posts,
        };
      }),
    };
  }

  private async buildFlowBoardRelationGroups({
    blog,
    focusNode,
    projection,
    rootFamilies,
    aggregateCounts,
    includePrivate,
    limit,
  }: {
    blog: Blog;
    focusNode: VisibleNodeRow;
    projection: BlogNodeProjection;
    rootFamilies: RootFamilyProjection;
    aggregateCounts: Map<string, number>;
    includePrivate: boolean;
    limit: number;
  }) {
    const focusRawIds = this.getDisplayNodeRawIds(focusNode, rootFamilies);
    let edges = await this.knowledgeEdgeRepository.find({
      where: [
        {
          userId: blog.userId,
          fromNodeId: In(focusRawIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
        {
          userId: blog.userId,
          toNodeId: In(focusRawIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
      ],
      order: {
        evidenceCount: "DESC",
        updatedAt: "DESC",
      },
      take: limit,
    });

    if (!includePrivate && edges.length > 0) {
      const sourceIds = Array.from(
        new Set(edges.map((edge) => edge.sourceId).filter(Boolean)),
      );
      if (sourceIds.length > 0) {
        const sources = await this.knowledgeSourceRepository.find({
          where: {
            userId: blog.userId,
            id: In(sourceIds),
          },
        });
        const visiblePostMap = await this.getPostSummaryMap(
          sources.map((source) => source.postId),
          false,
        );
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        edges = edges.filter((edge) => {
          const source = edge.sourceId ? sourceById.get(edge.sourceId) : null;
          return Boolean(source && visiblePostMap.has(source.postId));
        });
      } else {
        edges = [];
      }
    }

    const groups = {
      prerequisites: [] as VisibleNodeRow[],
      followups: [] as VisibleNodeRow[],
      duplicates: [] as VisibleNodeRow[],
    };
    const seenByGroup = {
      prerequisites: new Set<string>(),
      followups: new Set<string>(),
      duplicates: new Set<string>(),
    };

    const appendNode = (bucket: keyof typeof groups, rawNodeId: string) => {
      const rawNode = projection.allNodesMap.get(rawNodeId);
      if (!rawNode) {
        return;
      }

      const displayNode = this.getDisplayNode(rawNode, rootFamilies);
      if (displayNode.id === focusNode.id || seenByGroup[bucket].has(displayNode.id)) {
        return;
      }

      seenByGroup[bucket].add(displayNode.id);
      groups[bucket].push(displayNode);
    };

    for (const edge of edges) {
      const fromFocus = focusRawIds.includes(edge.fromNodeId);
      const toFocus = focusRawIds.includes(edge.toNodeId);

      if (edge.relationType === "prerequisite_of" && toFocus) {
        appendNode("prerequisites", edge.fromNodeId);
      }

      if (edge.relationType === "followup_to" && fromFocus) {
        appendNode("followups", edge.toNodeId);
      }

      if (edge.relationType === "duplicate_of") {
        const duplicateTarget = fromFocus ? edge.toNodeId : edge.fromNodeId;
        appendNode("duplicates", duplicateTarget);
      }
    }

    return {
      prerequisites: this.sortVisibleNodes(groups.prerequisites, aggregateCounts),
      followups: this.sortVisibleNodes(groups.followups, aggregateCounts),
      duplicates: this.sortVisibleNodes(groups.duplicates, aggregateCounts),
    };
  }

  private buildFlowBoardPanels({
    pathFromRoot,
    childNodes,
    relationGroups,
    aggregateCounts,
    rootFamilies,
    primaryFlowNodeIds,
  }: {
    pathFromRoot: VisibleNodeRow[];
    childNodes: VisibleNodeRow[];
    relationGroups: {
      prerequisites: VisibleNodeRow[];
      followups: VisibleNodeRow[];
      duplicates: VisibleNodeRow[];
    };
    aggregateCounts: Map<string, number>;
    rootFamilies: RootFamilyProjection;
    primaryFlowNodeIds: Set<string>;
  }): FlowBoardPanelDraft[] {
    void aggregateCounts;
    void rootFamilies;

    const panels: FlowBoardPanelDraft[] = [];

    const createPanel = (
      id: string,
      title: string,
      kind: FlowBoardItemKind,
      layoutHint: FlowBoardPanelLayoutHint,
      items: VisibleNodeRow[],
      take = 4,
    ) => {
      const filtered = items
        .filter((node) => !primaryFlowNodeIds.has(node.slug))
        .slice(0, take);
      if (filtered.length === 0) {
        return;
      }
      panels.push({
        id,
        title,
        kind,
        layoutHint,
        items: filtered,
      });
    };

    if (pathFromRoot.length > 1) {
      panels.push({
        id: "root-path",
        title: "이 주제가 놓인 흐름",
        kind: "path",
        layoutHint: "right",
        items: pathFromRoot.slice(0, -1),
      });
    }

    createPanel("children", "더 구체적인 주제", "child", "bottomLeft", childNodes, 4);
    createPanel(
      "prerequisites",
      "먼저 보면 좋은 주제",
      "prerequisite",
      "right",
      relationGroups.prerequisites,
      4,
    );
    createPanel(
      "followups",
      "이어서 보기 좋은 주제",
      "followup",
      "bottomRight",
      relationGroups.followups,
      4,
    );
    createPanel(
      "duplicates",
      "같이 보면 좋은 관점",
      "duplicate",
      "bottom",
      relationGroups.duplicates,
      4,
    );

    return panels.slice(0, 5);
  }

  private async getEvidencePostsForVisibleNodes(
    blog: Blog,
    nodes: VisibleNodeRow[],
    rootFamilies: RootFamilyProjection,
    includePrivate: boolean,
    take = 3,
  ) {
    const nodeIds = Array.from(
      new Set(
        nodes.flatMap((node) => this.getDisplayNodeRawIds(node, rootFamilies)),
      ),
    );

    if (nodeIds.length === 0) {
      return [];
    }

    const posts = await this.getLinkedPostsForNodes(blog, nodeIds, includePrivate);
    return posts.slice(0, take);
  }

  private async getPostSummaryMap(
    postIds: string[],
    includePrivate: boolean,
  ) {
    const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));
    if (uniquePostIds.length === 0) {
      return new Map<
        string,
        {
          id: string;
          title: string;
          slug: string;
          createdAt: Date;
          excerpt: string | null;
          category: string | null;
          thumbnail: string | null;
          blog: {
            slug: string | null;
            alias: string | null;
            name: string | null;
          };
        }
      >();
    }

    const posts = await this.postRepository.find({
      where: {
        id: In(uniquePostIds),
        isDeleted: false,
        isPublished: true,
        status: "published",
      },
      relations: ["blog"],
      order: { createdAt: "DESC" },
    });

    const visiblePosts = posts.filter((post) =>
      includePrivate ? true : post.visibility === "public",
    );

    if (visiblePosts.length === 0) {
      return new Map();
    }

    const metadata = await this.postMetadataRepository.find({
      where: visiblePosts.map((post) => ({ postId: post.id })),
    });
    const metadataMap = new Map(metadata.map((item) => [item.postId, item]));

    return new Map(
      visiblePosts.map((post) => [
        post.id,
        {
          id: post.id,
          title: post.title,
          slug: post.slug,
          createdAt: post.createdAt,
          excerpt: metadataMap.get(post.id)?.excerpt ?? null,
          category: metadataMap.get(post.id)?.category ?? null,
          thumbnail: post.thumbnailImageId ?? null,
          blog: {
            slug: post.blog?.slug ?? null,
            alias: post.blog?.alias ?? null,
            name: post.blog?.name ?? null,
          },
        },
      ]),
    );
  }

  private buildKnowledgeMapContextNodes({
    focusNode,
    projection,
    aggregatePostCounts,
    rootFamilies,
    rankedDirectNodes,
    excludedNodeIds,
    limit,
  }: {
    focusNode: VisibleNodeRow;
    projection: BlogNodeProjection;
    aggregatePostCounts: Map<string, number>;
    rootFamilies: RootFamilyProjection;
    rankedDirectNodes: VisibleNodeRow[];
    excludedNodeIds: Set<string>;
    limit: number;
  }) {
    const items: Array<{
      slug: string;
      title: string;
      canonicalPath: string;
      summary: string | null;
      nodeType: string;
      postCount: number;
      evidenceCount: number;
      contextType: "parent" | "child" | "sibling" | "hot";
    }> = [];
    const seenNodeIds = new Set<string>(excludedNodeIds);

    const appendCandidate = (
      candidate: VisibleNodeRow | undefined,
      contextType: "parent" | "child" | "sibling" | "hot",
    ) => {
      if (!candidate || items.length >= limit) {
        return;
      }

      const displayNode = this.getDisplayNode(candidate, rootFamilies);
      if (seenNodeIds.has(displayNode.id)) {
        return;
      }

      seenNodeIds.add(displayNode.id);
      items.push({
        slug: displayNode.slug,
        title: displayNode.title,
        canonicalPath: displayNode.canonicalPath,
        summary: displayNode.summary,
        nodeType: displayNode.nodeType,
        postCount: this.getDisplayPostCount(
          displayNode,
          aggregatePostCounts,
          rootFamilies,
        ),
        evidenceCount: this.getDisplayEvidenceCount(displayNode, rootFamilies),
        contextType,
      });
    };

    const appendCandidates = (
      candidates: VisibleNodeRow[],
      contextType: "parent" | "child" | "sibling" | "hot",
      take?: number,
    ) => {
      const sorted = this.sortVisibleNodes(candidates, aggregatePostCounts);
      const slice = take ? sorted.slice(0, take) : sorted;
      for (const candidate of slice) {
        appendCandidate(candidate, contextType);
        if (items.length >= limit) {
          return;
        }
      }
    };

    if (focusNode.parentNodeId) {
      appendCandidate(
        projection.allNodesMap.get(focusNode.parentNodeId),
        "parent",
      );
    }

    const focusFamily =
      !focusNode.parentNodeId
        ? rootFamilies.familyByMemberId.get(focusNode.id) ?? null
        : null;
    const childCandidates = focusFamily
      ? focusFamily.displayChildren
      : (projection.childrenMap.get(focusNode.id) ?? []);
    appendCandidates(childCandidates, "child", 4);

    if (focusNode.parentNodeId) {
      appendCandidates(
        (projection.childrenMap.get(focusNode.parentNodeId) ?? []).filter(
          (candidate) => candidate.id !== focusNode.id,
        ),
        "sibling",
        2,
      );
    }

    appendCandidates(rankedDirectNodes, "hot");

    return items.slice(0, limit);
  }

  private buildAggregatePostCountMap(projection: BlogNodeProjection) {
    const directCountMap = new Map(
      projection.directNodes.map((node) => [node.id, node.postCount]),
    );
    const aggregateCounts = new Map<string, number>();

    const visit = (node: VisibleNodeRow, visiting = new Set<string>()): number => {
      if (aggregateCounts.has(node.id)) {
        return aggregateCounts.get(node.id) as number;
      }

      if (visiting.has(node.id)) {
        this.logger.warn(
          `[KNOWLEDGE_TREE_CYCLE] context=buildAggregatePostCountMap nodeId=${node.id} slug=${node.slug}`,
        );
        return directCountMap.get(node.id) ?? node.postCount;
      }

      visiting.add(node.id);

      const childTotal = (projection.childrenMap.get(node.id) ?? []).reduce(
        (sum, child) => sum + visit(child, visiting),
        0,
      );
      visiting.delete(node.id);
      const total = (directCountMap.get(node.id) ?? 0) + childTotal;
      aggregateCounts.set(node.id, total);
      return total;
    };

    for (const rootNode of projection.childrenMap.get(null) ?? []) {
      visit(rootNode);
    }

    return aggregateCounts;
  }

  private getLastUpdatedAt(nodes: VisibleNodeRow[]) {
    return nodes.reduce<string | null>((latest, node) => {
      const value = node.updatedAt?.toISOString() ?? null;
      if (!value) {
        return latest;
      }
      if (!latest || value > latest) {
        return value;
      }
      return latest;
    }, null);
  }

  private buildBreadcrumb(
    node: VisibleNodeRow,
    allNodesMap: Map<string, VisibleNodeRow>,
  ) {
    const items: Array<{ slug: string; title: string; canonicalPath: string }> = [];
    let current: VisibleNodeRow | undefined = node;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current.id)) {
        this.logger.warn(
          `[KNOWLEDGE_TREE_CYCLE] context=buildBreadcrumb nodeId=${current.id} slug=${current.slug}`,
        );
        break;
      }
      visited.add(current.id);
      items.unshift({
        slug: current.slug,
        title: current.title,
        canonicalPath: current.canonicalPath,
      });
      current = current.parentNodeId
        ? allNodesMap.get(current.parentNodeId)
        : undefined;
    }

    return items;
  }

  private async getLinkedPostsForNodes(
    blog: Blog,
    nodeIds: string[],
    includePrivate: boolean,
  ) {
    const dedupedNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    if (dedupedNodeIds.length === 0) {
      return [];
    }

    const links = await this.postKnowledgeLinkRepository.find({
      where: { userId: blog.userId, nodeId: In(dedupedNodeIds) },
      order: { updatedAt: "DESC" },
    });

    if (links.length === 0) {
      return [];
    }

    const postIds = links.map((link) => link.postId);
    const posts = await this.postRepository.find({
      where: {
        id: In(postIds),
        blogId: blog.id,
        isDeleted: false,
        isPublished: true,
        status: "published",
      },
      relations: ["blog"],
      order: { createdAt: "DESC" },
    });

    const visiblePosts = posts.filter((post) =>
      includePrivate ? true : post.visibility === "public",
    );

    if (visiblePosts.length === 0) {
      return [];
    }

    const metadata = await this.postMetadataRepository.find({
      where: visiblePosts.map((post) => ({ postId: post.id })),
    });
    const metadataMap = new Map(metadata.map((item) => [item.postId, item]));

    return visiblePosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      createdAt: post.createdAt,
      excerpt: metadataMap.get(post.id)?.excerpt ?? null,
      category: metadataMap.get(post.id)?.category ?? null,
      thumbnail: post.thumbnailImageId ?? null,
      blog: {
        slug: post.blog?.slug ?? null,
        alias: post.blog?.alias ?? null,
        name: post.blog?.name ?? null,
      },
    }));
  }

  private async getRelatedNodesForBlog(
    userId: string,
    nodeIds: string[],
    projection: BlogNodeProjection,
  ) {
    const dedupedNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    if (dedupedNodeIds.length === 0) {
      return [];
    }

    const edges = await this.knowledgeEdgeRepository.find({
      where: [
        {
          userId,
          fromNodeId: In(dedupedNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
        {
          userId,
          toNodeId: In(dedupedNodeIds),
          relationType: In([...PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES]),
        },
      ],
      order: { evidenceCount: "DESC", updatedAt: "DESC" },
      take: 8,
    });

    const related = edges
      .map((edge) => {
        const otherNodeId = dedupedNodeIds.includes(edge.fromNodeId)
          ? edge.toNodeId
          : edge.fromNodeId;
        const otherNode = projection.allNodesMap.get(otherNodeId);
        if (!otherNode) {
          return null;
        }

        return {
          slug: otherNode.slug,
          title: otherNode.title,
          canonicalPath: otherNode.canonicalPath,
          summary: otherNode.summary,
          relationType: edge.relationType,
          evidenceCount: otherNode.evidenceCount,
          postCount: otherNode.postCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const seen = new Set<string>();
    return related.filter((item) => {
      if (seen.has(item.slug)) {
        return false;
      }
      seen.add(item.slug);
      return true;
    });
  }

  private buildRootFamilyProjection(
    projection: BlogNodeProjection,
    aggregateCounts: Map<string, number>,
  ): RootFamilyProjection {
    const rootNodes = projection.childrenMap.get(null) ?? [];
    const groups = new Map<string, VisibleNodeRow[]>();

    for (const rootNode of rootNodes) {
      const canonicalRoot = getKnowledgeNodeCanonicalRoot(rootNode);
      const key = canonicalRoot.slug;
      const existing = groups.get(key) ?? [];
      existing.push(rootNode);
      groups.set(key, existing);
    }

    const families: RootFamily[] = [];
    const familyByRepresentativeId = new Map<string, RootFamily>();
    const familyByMemberId = new Map<string, RootFamily>();

    for (const members of groups.values()) {
      const sortedMembers = members
        .slice()
        .sort((left, right) =>
          this.compareRootRepresentativePriority(left, right, aggregateCounts),
        );
      const representative = sortedMembers[0];
      const representativeIsCanonical =
        representative.nodeType === "domain" &&
        this.isCanonicalDomainNode(representative);
      const displayChildren = this.sortVisibleNodes(
        this.dedupeVisibleNodes(
          representativeIsCanonical
            ? (projection.childrenMap.get(representative.id) ?? []).filter((child) =>
                this.matchesRootFamily(child, representative),
              )
            : sortedMembers.flatMap(
                (member) => projection.childrenMap.get(member.id) ?? [],
              ),
        ),
        aggregateCounts,
      );

      const family: RootFamily = {
        representative,
        members: sortedMembers,
        displayChildren,
      };

      families.push(family);
      familyByRepresentativeId.set(representative.id, family);
      for (const member of sortedMembers) {
        familyByMemberId.set(member.id, family);
      }
    }

    families.sort((left, right) => {
      const rightCount = this.getFamilyAggregatePostCount(right, aggregateCounts);
      const leftCount = this.getFamilyAggregatePostCount(left, aggregateCounts);
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }
      const rightEvidence = this.getFamilyEvidenceCount(right);
      const leftEvidence = this.getFamilyEvidenceCount(left);
      if (rightEvidence !== leftEvidence) {
        return rightEvidence - leftEvidence;
      }
      return left.representative.title.localeCompare(
        right.representative.title,
        "ko",
      );
    });

    return {
      families,
      familyByRepresentativeId,
      familyByMemberId,
    };
  }

  private normalizeKnowledgeTitle(title: string) {
    return normalizeKnowledgeRootTitle(title);
  }

  private isCanonicalDomainNode(node: VisibleNodeRow) {
    const canonicalRoot = getKnowledgeNodeCanonicalRoot(node);
    return node.nodeType === "domain" && node.slug === canonicalRoot.slug;
  }

  private matchesRootFamily(
    node: VisibleNodeRow,
    representative: VisibleNodeRow,
  ) {
    const familyRoot = getKnowledgeNodeCanonicalRoot(representative);
    const nodeRoot = getKnowledgeNodeCanonicalRoot(node);

    return (
      nodeRoot.slug === familyRoot.slug ||
      this.normalizeKnowledgeTitle(node.title) === familyRoot.title
    );
  }

  private compareRootRepresentativePriority(
    left: VisibleNodeRow,
    right: VisibleNodeRow,
    aggregateCounts: Map<string, number>,
  ) {
    const leftCanonical = this.isCanonicalDomainNode(left) ? 1 : 0;
    const rightCanonical = this.isCanonicalDomainNode(right) ? 1 : 0;
    if (rightCanonical !== leftCanonical) {
      return rightCanonical - leftCanonical;
    }

    const rightAggregate = aggregateCounts.get(right.id) ?? right.postCount;
    const leftAggregate = aggregateCounts.get(left.id) ?? left.postCount;
    if (rightAggregate !== leftAggregate) {
      return rightAggregate - leftAggregate;
    }

    if (right.postCount !== left.postCount) {
      return right.postCount - left.postCount;
    }

    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }

    return left.slug.localeCompare(right.slug, "ko");
  }

  private dedupeVisibleNodes(nodes: VisibleNodeRow[]) {
    const seen = new Set<string>();
    return nodes.filter((node) => {
      if (seen.has(node.id)) {
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }

  private sortVisibleNodes(
    nodes: VisibleNodeRow[],
    aggregateCounts: Map<string, number>,
  ) {
    return nodes.slice().sort((left, right) => {
      const rightAggregate = aggregateCounts.get(right.id) ?? right.postCount;
      const leftAggregate = aggregateCounts.get(left.id) ?? left.postCount;
      if (rightAggregate !== leftAggregate) {
        return rightAggregate - leftAggregate;
      }
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.title.localeCompare(right.title, "ko");
    });
  }

  private getFamilyAggregatePostCount(
    family: RootFamily,
    aggregateCounts: Map<string, number>,
  ) {
    return family.members.reduce(
      (sum, member) => sum + (aggregateCounts.get(member.id) ?? member.postCount),
      0,
    );
  }

  private getFamilyEvidenceCount(family: RootFamily) {
    return family.members.reduce(
      (sum, member) => sum + (member.evidenceCount ?? 0),
      0,
    );
  }

  private canAccessPrivateBlog(blog: Blog, viewer?: User) {
    return Boolean(
      viewer && (viewer.id === blog.userId || viewer.role === Role.ADMIN),
    );
  }

  private canAccessPost(post: Post, blog: Blog, viewer?: User) {
    if (post.isDeleted || !post.isPublished || post.status !== "published") {
      return false;
    }
    if (blog.isPublic && post.visibility === "public") {
      return true;
    }
    return this.canAccessPrivateBlog(blog, viewer);
  }
}
