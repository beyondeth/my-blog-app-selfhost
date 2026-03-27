/**
 * 마켓플레이스 타입 정의
 */

/** 상품 카테고리 */
export const ProductCategory = {
  AI_PROMPTS: 'ai_prompts',
  CODING_TEMPLATES: 'coding_templates',
  TECH_GUIDES: 'tech_guides',
  AI_WORKFLOWS: 'ai_workflows',
  DATA_ANALYTICS: 'data_analytics',
  OTHERS: 'others',
} as const;

export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];

/** 카테고리 표시명 */
export const ProductCategoryLabel: Record<ProductCategory, string> = {
  ai_prompts: 'AI 프롬프트',
  coding_templates: '코딩 템플릿',
  tech_guides: '기술 가이드',
  ai_workflows: 'AI 스킬/워크플로',
  data_analytics: '데이터/분석',
  others: '기타',
};

/** 주문 상태 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

/** 마켓플레이스 상품 (목록용 경량) */
export interface MarketplaceProduct {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnailImageId?: string;
  createdAt: string;
  author?: {
    id: string;
    username: string;
  };
  productDetail?: {
    price: number;
    currency: string;
    productCategory: ProductCategory;
    categoryLabel: string;
    salesCount: number;
  };
}

/** 배송 항목 (구매자 전용 콘텐츠) */
export interface DeliveryItem {
  id: string;
  type: 'content_html' | 'file' | 'external_link';
  label: string;
  sortOrder: number;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  contentHtml?: string | null;
  externalUrl?: string | null;
}

/** 상품 상세 (전체 정보) */
export interface MarketplaceProductDetail extends MarketplaceProduct {
  content: string | null;
  /** 공개 마케팅 설명 (모든 사용자에게 표시) */
  descriptionHtml?: string | null;
  isFullContent: boolean;
  hasPurchased: boolean;
  /** 환불 요청에 사용할 주문 ID (구매 완료 시에만 존재) */
  orderId?: string | null;
  isOwner: boolean;
  /** 목차 (h2, h3 헤딩 목록 — 미구매자도 전체 구성 파악 가능) */
  tableOfContents?: string[];
  /** 배송 항목 (구매자/소유자에게만 반환) */
  deliveryItems?: DeliveryItem[];
  blog?: {
    id: string;
    slug: string;
    alias?: string;
  };
  productDetail: {
    price: number;
    currency: string;
    productCategory: ProductCategory;
    categoryLabel: string;
    salesCount: number;
    deliveryType: 'content' | 'file' | 'mixed';
    deliveryItemCount?: number;
    digitalDeliveryUrl: string | null;
    isActive: boolean;
  };
  refundStatus?: string | null;
}

/** 마켓플레이스 목록 응답 */
export interface MarketplaceListResponse {
  products: MarketplaceProduct[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** 카테고리 + 상품 수 */
export interface CategoryCount {
  category: ProductCategory;
  label: string;
  count: number;
}

/** 구매 준비 응답 */
export interface PreparePurchaseResponse {
  alreadyPurchased: boolean;
  orderId?: string;
  amount?: number;
  orderName?: string;
  customerKey?: string;
  successUrl?: string;
  failUrl?: string;
  order?: Order;
}

/** 주문 정보 */
export interface Order {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  productPostId: string;
  amount: number;
  platformFee: number;
  sellerRevenue: number;
  status: OrderStatus;
  paymentKey?: string;
  receiptUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  productPost?: {
    id: string;
    title: string;
    slug: string;
    thumbnailImageId?: string;
  };
  seller?: {
    id: string;
    username: string;
  };
}

/** 상품 리뷰 */
export interface ProductReview {
  id: string;
  productPostId: string;
  buyerId: string | null;
  rating: number;
  content?: string | null;
  images: { fileKey: string; fileName: string }[];
  isVerifiedPurchase: boolean;
  sellerResponse?: string | null;
  sellerRespondedAt?: string | null;
  createdAt: string;
  buyer?: { id: string; username: string; profileImage?: string };
}

/** 리뷰 요약 */
export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  ratingDistribution: Record<number, number>;
}

/** 판매자 신뢰 지표 */
export interface SellerTrustSignals {
  isVerified: boolean;
  totalSales: number;
  averageRating: number;
  totalReviews: number;
  badges: string[];
  responseRate: number | null;
}

/** 브라우즈 파라미터 */
export interface BrowseParams {
  cursor?: string;
  limit?: number;
  category?: ProductCategory;
  search?: string;
  sort?: 'recent' | 'popular' | 'price_low' | 'price_high';
  priceMin?: number;
  priceMax?: number;
}
