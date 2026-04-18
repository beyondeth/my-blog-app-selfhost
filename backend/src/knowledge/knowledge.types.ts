import {
  KNOWLEDGE_COMPILE_STATUSES,
  KNOWLEDGE_ARTIFACT_STATUSES,
  KNOWLEDGE_CANDIDATE_STATUSES,
  KNOWLEDGE_FOLLOWUP_STATUSES,
  KNOWLEDGE_ALIAS_SOURCE_TYPES,
  KNOWLEDGE_ALIAS_STATUSES,
  KNOWLEDGE_LINK_ROLES,
  KNOWLEDGE_NODE_STATUSES,
  KNOWLEDGE_NODE_TYPES,
  KNOWLEDGE_RELATION_TYPES,
  KNOWLEDGE_SOURCE_STATUSES,
} from "./knowledge.constants";

export type KnowledgeNodeType = (typeof KNOWLEDGE_NODE_TYPES)[number];
export type KnowledgeNodeStatus = (typeof KNOWLEDGE_NODE_STATUSES)[number];
export type KnowledgeRelationType =
  (typeof KNOWLEDGE_RELATION_TYPES)[number];
export type KnowledgeSourceStatus = (typeof KNOWLEDGE_SOURCE_STATUSES)[number];
export type KnowledgeLinkRole = (typeof KNOWLEDGE_LINK_ROLES)[number];
export type KnowledgeFollowupStatus =
  (typeof KNOWLEDGE_FOLLOWUP_STATUSES)[number];
export type KnowledgeCompileStatus =
  (typeof KNOWLEDGE_COMPILE_STATUSES)[number];
export type KnowledgeArtifactStatus =
  (typeof KNOWLEDGE_ARTIFACT_STATUSES)[number];
export type KnowledgeCandidateStatus =
  (typeof KNOWLEDGE_CANDIDATE_STATUSES)[number];
export type KnowledgeAliasStatus =
  (typeof KNOWLEDGE_ALIAS_STATUSES)[number];
export type KnowledgeAliasSourceType =
  (typeof KNOWLEDGE_ALIAS_SOURCE_TYPES)[number];

export interface KnowledgeSourceSnapshot {
  title: string;
  excerpt: string;
  category: string;
  categorySegments: string[];
  tags: string[];
  blogSlug?: string | null;
  blogAlias?: string | null;
  contentType: string;
  markdown: string;
  renderedContent: string;
  strippedText: string;
  headings: string[];
  outboundUrls: string[];
}

export interface KnowledgeArtifactSectionNode {
  id: string;
  title: string;
  level: number;
  summary: string | null;
  children: KnowledgeArtifactSectionNode[];
}

export interface KnowledgeSourceArtifactPayload {
  declaredMetadata: {
    category: string;
    categorySegments: string[];
    tags: string[];
    headings: string[];
    outboundUrls: string[];
    blogSlug: string | null;
    blogAlias: string | null;
  };
  sectionTree: KnowledgeArtifactSectionNode[];
  compiled: {
    mode: "heuristic" | "llm";
    primaryNodes: KnowledgeCompilerNodeDraft[];
    secondaryNodes: KnowledgeCompilerNodeDraft[];
    edges: KnowledgeCompilerEdgeDraft[];
    postLinks: KnowledgeCompilerPostLinkDraft[];
    followups: KnowledgeCompilerFollowupDraft[];
  };
  draft: KnowledgeDraft | null;
}

export interface KnowledgeDraftNodeInput {
  label: string;
  nodeType?: KnowledgeNodeType;
  parentLabel?: string | null;
  summary?: string | null;
  confidence?: number | null;
  evidenceRefs?: string[];
}

export interface KnowledgeDraftEdgeInput {
  fromLabel: string;
  toLabel: string;
  relation: KnowledgeRelationType;
  confidence?: number | null;
  reason?: string | null;
  evidenceRefs?: string[];
}

export interface KnowledgeDraft {
  rootLabel?: string | null;
  nodes?: KnowledgeDraftNodeInput[];
  edges?: KnowledgeDraftEdgeInput[];
  aliases?: string[];
}

export interface KnowledgeCandidateNode {
  id: string;
  slug: string;
  title: string;
  canonicalPath: string;
  summary: string | null;
  nodeType: KnowledgeNodeType;
  parentNodeId: string | null;
  evidenceCount: number;
  postCount: number;
}

export interface KnowledgeManifestTreeItem {
  slug: string;
  title: string;
  canonicalPath: string;
  postCount: number;
  evidenceCount: number;
  children: KnowledgeManifestTreeItem[];
}

export interface KnowledgeManifestSnapshot {
  userId: string;
  version: number;
  generatedAt: string;
  tree: KnowledgeManifestTreeItem[];
  hotNodes: Array<{
    slug: string;
    title: string;
    canonicalPath: string;
    postCount: number;
    evidenceCount: number;
  }>;
  recentChanges: Array<{
    postId: string;
    status: KnowledgeCompileStatus;
    completedAt: string | null;
    contentHash: string;
  }>;
  followups: Array<{
    id: string;
    title: string;
    reason: string;
    status: KnowledgeFollowupStatus;
    nodeSlug: string | null;
    postId: string | null;
  }>;
}

export interface KnowledgeCompilerNodeDraft {
  slug: string;
  title: string;
  nodeType: KnowledgeNodeType;
  parentSlug?: string | null;
  summary?: string | null;
}

export interface KnowledgeCompilerEdgeDraft {
  fromSlug: string;
  toSlug: string;
  relation: KnowledgeRelationType;
  confidence?: number;
  reason?: string | null;
}

export interface KnowledgeCompilerPostLinkDraft {
  nodeSlug: string;
  role: KnowledgeLinkRole;
  confidence?: number;
}

export interface KnowledgeCompilerFollowupDraft {
  title: string;
  nodeSlug?: string | null;
  reason: string;
}

export interface KnowledgeCompileResult {
  mode: "heuristic" | "llm";
  primaryNodes: KnowledgeCompilerNodeDraft[];
  secondaryNodes: KnowledgeCompilerNodeDraft[];
  edges: KnowledgeCompilerEdgeDraft[];
  postLinks: KnowledgeCompilerPostLinkDraft[];
  followups: KnowledgeCompilerFollowupDraft[];
}

export interface KnowledgeCompileContext {
  userId: string;
  blogId: string | null;
  postId: string;
  postVersion: number;
  source: KnowledgeSourceSnapshot;
  contentHash: string;
  manifest: KnowledgeManifestSnapshot | null;
  candidates: KnowledgeCandidateNode[];
}

export interface KnowledgeCompileJobData {
  postId: string;
  userId: string;
  blogId?: string | null;
}

export interface PostProcessingCompletedEvent {
  postId: string;
  userId?: string | null;
  blogId?: string | null;
  status: "published" | "failed";
}

export interface KnowledgeRemovePostJobData {
  postId: string;
  userId: string;
  reason: "unpublished" | "deleted" | "permanent-delete";
}

export interface KnowledgeCompileQueueResult {
  success: boolean;
  postId: string;
  status: KnowledgeCompileStatus;
  contentHash?: string;
  error?: string;
}
