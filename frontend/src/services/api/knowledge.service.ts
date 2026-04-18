const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export interface KnowledgeTreeNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  postCount: number;
  evidenceCount: number;
  children: KnowledgeTreeNode[];
}

export interface KnowledgeHotNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  postCount: number;
  evidenceCount: number;
}

export interface BlogKnowledgeTreeResponse {
  tree: KnowledgeTreeNode[];
  hotNodes: KnowledgeHotNode[];
  nodeCount: number;
  lastUpdatedAt: string | null;
}

export interface KnowledgeMapNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  isFocus: boolean;
}

export interface KnowledgeMapContextNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  contextType: "parent" | "child" | "sibling" | "hot";
}

export interface KnowledgeMapEdge {
  fromSlug: string;
  toSlug: string;
  relationType: string;
  confidence?: number | null;
  reason?: string | null;
  evidenceCount: number;
}

export interface BlogKnowledgeMapResponse {
  requestedFocusSlug?: string | null;
  resolvedFocusSlug?: string | null;
  requestedFocusFound?: boolean;
  focusNode: Omit<KnowledgeMapNode, "isFocus"> | null;
  nodes: KnowledgeMapNode[];
  edges: KnowledgeMapEdge[];
  contextNodes: KnowledgeMapContextNode[];
  hotNodes: KnowledgeHotNode[];
  nodeCount: number;
  lastUpdatedAt: string | null;
  hasExplicitEdges: boolean;
}

export interface KnowledgeCanvasNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  depth: number;
  isOnFocusPath: boolean;
}

export interface KnowledgeCanvasTreeEdge {
  fromSlug: string;
  toSlug: string;
}

export interface KnowledgeCanvasFactEdge {
  edgeKey: string;
  fromSlug: string;
  toSlug: string;
  relationType: string;
  confidence?: number | null;
  reason?: string | null;
  evidenceCount: number;
}

export interface KnowledgeCanvasPostSummary {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  excerpt?: string | null;
  category?: string | null;
  thumbnail?: string | null;
  blog: {
    slug: string | null;
    alias?: string | null;
    name?: string | null;
  };
}

export interface KnowledgeCanvasResponse {
  requestedFocusSlug?: string | null;
  resolvedFocusSlug?: string | null;
  requestedFocusFound?: boolean;
  rootNode: KnowledgeCanvasNode | null;
  focusNode: KnowledgeCanvasNode | null;
  pathFromRoot: KnowledgeCanvasNode[];
  nodes: KnowledgeCanvasNode[];
  treeEdges: KnowledgeCanvasTreeEdge[];
  factEdges: KnowledgeCanvasFactEdge[];
  provenance: {
    nodes: Record<
      string,
      {
        postCount: number;
        posts: KnowledgeCanvasPostSummary[];
      }
    >;
    edges: Array<{
      edgeKey: string;
      sourceCount: number;
      posts: KnowledgeCanvasPostSummary[];
    }>;
  };
  insights: {
    followups: Array<{
      id: string;
      title: string;
      reason: string;
      status: string;
      nodeSlug: string | null;
      postId: string | null;
    }>;
  } | null;
  viewerCanSeeInsights: boolean;
  hotNodes: KnowledgeHotNode[];
  nodeCount: number;
  lastUpdatedAt: string | null;
}

export interface KnowledgeFlowBoardNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  nodeType: string;
  postCount: number;
  evidenceCount: number;
  kind:
    | "path"
    | "focus"
    | "child"
    | "prerequisite"
    | "followup"
    | "duplicate";
}

export interface KnowledgeFlowBoardPanel {
  id: string;
  title: string;
  items: KnowledgeFlowBoardNode[];
  evidencePosts: KnowledgeCanvasPostSummary[];
  layoutHint: "right" | "bottomLeft" | "bottomRight" | "bottom";
}

export interface KnowledgeFlowBoardResponse {
  requestedFocusSlug?: string | null;
  resolvedFocusSlug?: string | null;
  requestedFocusFound?: boolean;
  rootPath: KnowledgeFlowBoardNode[];
  focus: KnowledgeFlowBoardNode | null;
  primaryFlow: {
    id: string;
    title: string;
    items: KnowledgeFlowBoardNode[];
    evidencePosts: KnowledgeCanvasPostSummary[];
  } | null;
  detailPanels: KnowledgeFlowBoardPanel[];
  hotNodes: KnowledgeHotNode[];
  nodeCount: number;
  lastUpdatedAt: string | null;
}

export interface KnowledgeNodeSummary {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  postCount?: number;
  evidenceCount?: number;
  relationType?: string;
}

export interface PostKnowledgeContextResponse {
  breadcrumb: Array<{
    slug: string;
    title: string;
    canonicalPath: string;
  }>;
  canonicalPath: string | null;
  primaryNodes: KnowledgeNodeSummary[];
  secondaryNodes: KnowledgeNodeSummary[];
  relatedNodes: KnowledgeNodeSummary[];
}

export interface TrendingKnowledgeNode {
  slug: string;
  title: string;
  canonicalPath: string;
  summary?: string | null;
  postCount: number;
  evidenceCount: number;
  blog: {
    slug: string;
    alias?: string | null;
    name: string;
  };
}

async function parseJsonOrThrow<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }

  return response.json();
}

export async function getBlogKnowledgeTree(
  blogSlug: string,
): Promise<BlogKnowledgeTreeResponse> {
  const response = await fetch(
    `${API_URL}/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-tree`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseJsonOrThrow(response, "Failed to fetch blog knowledge tree");
}

export async function getBlogKnowledgeMap(
  blogSlug: string,
  focusSlug?: string,
  limit = 12,
): Promise<BlogKnowledgeMapResponse> {
  const params = new URLSearchParams();
  if (focusSlug) {
    params.set("focus", focusSlug);
  }
  if (limit) {
    params.set("limit", String(limit));
  }

  const response = await fetch(
    `${API_URL}/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-map${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseJsonOrThrow(response, "Failed to fetch blog knowledge map");
}

export async function getBlogKnowledgeCanvas(
  blogSlug: string,
  focusSlug?: string,
  limit = 36,
): Promise<KnowledgeCanvasResponse> {
  const params = new URLSearchParams();
  if (focusSlug) {
    params.set("focus", focusSlug);
  }
  if (limit) {
    params.set("limit", String(limit));
  }

  const response = await fetch(
    `${API_URL}/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-canvas${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseJsonOrThrow(response, "Failed to fetch blog knowledge canvas");
}

export async function getBlogKnowledgeFlowBoard(
  blogSlug: string,
  focusSlug?: string,
  limit = 24,
): Promise<KnowledgeFlowBoardResponse> {
  const params = new URLSearchParams();
  if (focusSlug) {
    params.set("focus", focusSlug);
  }
  if (limit) {
    params.set("limit", String(limit));
  }

  const response = await fetch(
    `${API_URL}/blogs/slug/${encodeURIComponent(blogSlug)}/knowledge-flow-board${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseJsonOrThrow(
    response,
    "Failed to fetch blog knowledge flow board",
  );
}

export async function getTrendingKnowledgeNodes(
  limit = 5,
): Promise<TrendingKnowledgeNode[]> {
  const response = await fetch(
    `${API_URL}/feed/knowledge/trending?limit=${limit}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return parseJsonOrThrow(response, "Failed to fetch trending knowledge nodes");
}

export async function getPostKnowledgeContext(
  postId: string,
): Promise<PostKnowledgeContextResponse> {
  const response = await fetch(`${API_URL}/posts/${postId}/knowledge-context`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return parseJsonOrThrow(response, "Failed to fetch post knowledge context");
}
