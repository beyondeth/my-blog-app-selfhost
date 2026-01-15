import { IsUrl, IsNotEmpty } from "class-validator";

/**
 * Open Graph 메타데이터 조회 요청 DTO
 */
export class FetchOpenGraphDto {
  @IsUrl({}, { message: "유효한 URL을 입력해주세요." })
  @IsNotEmpty({ message: "URL은 필수입니다." })
  url: string;
}

/**
 * Open Graph 메타데이터 응답 DTO
 *
 * @description
 * URL에서 추출한 Open Graph 메타데이터입니다.
 * 링크 카드 표시에 사용됩니다.
 */
export class OpenGraphResponseDto {
  /** 원본 URL */
  url: string;

  /** 페이지 제목 (og:title 또는 <title>) */
  title?: string;

  /** 페이지 설명 (og:description 또는 meta description) */
  description?: string;

  /** 대표 이미지 URL (og:image) */
  imageUrl?: string;

  /** 사이트 이름 (og:site_name) */
  siteName?: string;

  /** 콘텐츠 타입 (og:type) */
  type?: string;

  /** 파비콘 URL */
  faviconUrl?: string;

  /** 도메인 (예: github.com) */
  domain?: string;

  /** 성공 여부 */
  success: boolean;

  /** 에러 메시지 (실패 시) */
  error?: string;
}
