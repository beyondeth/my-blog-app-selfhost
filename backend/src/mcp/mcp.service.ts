import { Injectable } from '@nestjs/common';

/**
 * MCP Service - 최소화된 서비스
 *
 * MCP는 오직 포스트 생성만 가능하며, 실제 생성 로직은 PostsService에 위임합니다.
 * 조회/수정/삭제 기능은 보안상 제거되었습니다.
 */
@Injectable()
export class McpService {
  constructor() {}

  // MCP는 오직 포스트 생성만 지원
  // 실제 생성 로직은 MCP Controller에서 PostsService.create()를 직접 호출
  // 이를 통해 일반 포스팅과 동일한 로직 보장
}