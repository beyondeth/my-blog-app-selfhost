/**
 * 마켓플레이스 상품 카테고리
 * 사업계획서 기반: AI 지식 콘텐츠 거래 플랫폼
 */
export const ProductCategory = {
  AI_PROMPTS: "ai_prompts",
  CODING_TEMPLATES: "coding_templates",
  TECH_GUIDES: "tech_guides",
  AI_WORKFLOWS: "ai_workflows",
  DATA_ANALYTICS: "data_analytics",
  OTHERS: "others",
} as const;

export type ProductCategory =
  (typeof ProductCategory)[keyof typeof ProductCategory];

/** 카테고리 표시명 매핑 (프론트엔드/API 응답용) */
export const ProductCategoryLabel: Record<ProductCategory, string> = {
  [ProductCategory.AI_PROMPTS]: "AI 프롬프트",
  [ProductCategory.CODING_TEMPLATES]: "코딩 템플릿",
  [ProductCategory.TECH_GUIDES]: "기술 가이드",
  [ProductCategory.AI_WORKFLOWS]: "AI 스킬/워크플로",
  [ProductCategory.DATA_ANALYTICS]: "데이터/분석",
  [ProductCategory.OTHERS]: "기타",
};
