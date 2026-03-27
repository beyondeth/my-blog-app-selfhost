/**
 * 포스트 유형
 * - BLOG: 일반 블로그 포스트 (기존 포스트 전부)
 * - PRODUCT: 마켓플레이스 판매 상품
 */
export const PostType = {
  BLOG: "blog",
  PRODUCT: "product",
} as const;

export type PostType = (typeof PostType)[keyof typeof PostType];
