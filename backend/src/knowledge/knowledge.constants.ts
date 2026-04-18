export const KNOWLEDGE_COMPILE_QUEUE = "knowledge-compile";

export const KnowledgeEvents = {
  POST_PROCESSING_COMPLETED: "post.processing.completed",
} as const;

export const KNOWLEDGE_RELATION_TYPES = [
  "related_to",
  "followup_to",
  "prerequisite_of",
  "duplicate_of",
] as const;

export const PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES = [
  "followup_to",
  "prerequisite_of",
  "duplicate_of",
] as const;

export const KNOWLEDGE_NODE_TYPES = [
  "domain",
  "topic",
  "concept",
  "question",
] as const;

export const KNOWLEDGE_NODE_STATUSES = ["active", "archived"] as const;

export const KNOWLEDGE_SOURCE_STATUSES = [
  "pending",
  "compiled",
  "stale",
  "deleted",
  "failed",
] as const;

export const KNOWLEDGE_ARTIFACT_STATUSES = [
  "active",
  "stale",
  "deleted",
] as const;

export const KNOWLEDGE_CANDIDATE_STATUSES = [
  "provisional",
  "approved",
  "rejected",
  "merged",
] as const;

export const KNOWLEDGE_ALIAS_STATUSES = ["active", "archived"] as const;

export const KNOWLEDGE_ALIAS_SOURCE_TYPES = [
  "seed",
  "artifact",
  "draft",
  "manual",
] as const;

export const KNOWLEDGE_LINK_ROLES = [
  "primary",
  "secondary",
  "reference",
] as const;

export const KNOWLEDGE_FOLLOWUP_STATUSES = [
  "pending",
  "dismissed",
  "accepted",
] as const;

export const KNOWLEDGE_COMPILE_STATUSES = [
  "queued",
  "processing",
  "compiled",
  "failed",
  "skipped",
] as const;

export const KNOWLEDGE_MAX_PRIMARY_NODES = 1;
export const KNOWLEDGE_MAX_SECONDARY_NODES = 5;
export const KNOWLEDGE_MAX_EDGES = 8;
export const KNOWLEDGE_MAX_FOLLOWUPS = 3;
export const KNOWLEDGE_MAX_TREE_DEPTH = 4;
