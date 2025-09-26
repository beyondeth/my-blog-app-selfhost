import { SessionBasedAuth } from "./auth-session.js";

/**
 * 블로그 포스트 인터페이스
 */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  blogSlug?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * MCP 블로그 API 클라이언트 (Proxy Server 경유)
 *
 * MCP 프록시 서버를 통해 블로그 포스트를 생성하는 세션 기반 클라이언트
 * 모든 API 호출은 Proxy Server를 경유하여 자동으로 토큰 관리가 이루어짐
 *
 * 역할:
 * - 세션 ID 기반 인증
 * - MCP 프록시 서버로 요청 전달
 * - 자동 토큰 갱신 (프록시 서버에서 처리)
 *
 * 아키텍처:
 * MCP Client (세션 ID) → Proxy Server (:8080) → Backend API (:3000)
 */
export class BlogAPIClient {
  constructor(private auth: SessionBasedAuth) {}

  /**
   * MCP 프록시를 통한 포스트 생성
   *
   * Proxy Server의 /api/v1/mcp/sessions/proxy를 통해 요청을 전달합니다.
   * 토큰 관리와 갱신은 Proxy Server에서 자동으로 처리됩니다.
   *
   * @param title - 포스트 제목
   * @param markdownContent - 마크다운 형식의 포스트 내용
   * @param tags - 태그 배열 (선택적)
   * @param qualityScore - 품질 점수 0-100 (선택적, AI 생성 컨텐츠 추적용)
   * @returns 생성된 블로그 포스트 정보
   */
  public async createPost(
    title: string,
    markdownContent: string,
    tags?: string[],
    qualityScore?: number
  ): Promise<BlogPost> {
    // 세션 기반 인증 확인 - 자동 인증 시도 제거
    // ensureAuthenticated에서 이미 인증을 체크하므로 여기서는 단순 확인만
    if (!this.auth.isAuthenticated()) {
      console.error("❌ 인증되지 않은 상태입니다. authenticate 도구를 먼저 호출해주세요.");
      throw new Error("인증이 필요합니다. 먼저 'authenticate' 도구를 호출해주세요.");
    }

    // Backend API의 실제 엔드포인트
    const apiPath = `/mcp/posts`;
    const method = "POST";

    // 🔍 DEBUG: markdownContent가 base64인지 확인
    console.log("🔍 DEBUG - markdownContent first 200 chars:", markdownContent.substring(0, 200));
    console.log("🔍 DEBUG - Is markdownContent base64?:", /^[A-Za-z0-9+/]+=*$/.test(markdownContent) ? "YES - base64 발견!" : "NO - 정상 마크다운");

    // 요청 본문 - 원본 마크다운을 직접 전송 (HMAC 방식과 동일)
    const bodyData = {
      title,
      content_markdown: markdownContent,  // content_markdown 필드로 마크다운 전송 (백엔드가 마크다운으로 인식하도록)
      tags: tags || [],
      qualityScore: qualityScore !== undefined ? qualityScore : undefined,
      // blogId와 userId는 백엔드에서 토큰으로부터 추출하여 강제 설정됨
    };

    // 디버그 로깅
    console.log(`📝 포스트 생성 요청 (Proxy Server 경유):`, {
      title: bodyData.title,
      tags: bodyData.tags,
      qualityScore: bodyData.qualityScore,
      contentLength: `${markdownContent.length} chars`,
      contentPreview: `${markdownContent.substring(0, 50)}...`,
    });

    try {
      // Proxy Server를 통해 요청 전달
      // proxyRequest가 자동으로 세션 ID를 헤더에 추가하고 토큰 관리를 처리
      const result = await this.auth.proxyRequest(
        method,
        apiPath,
        bodyData
      ) as BlogPost;

      console.log(`✅ 포스트 생성 성공: ${result.slug}`);
      return result;

    } catch (error) {
      // 에러 처리 - 재인증 시도 제거
      console.error("❌ 포스트 생성 중 에러:", error);

      // 세션 만료 시 안내 메시지만 제공 (자동 재인증 시도하지 않음)
      if (error instanceof Error && error.message.includes("401")) {
        console.error("🔄 세션이 만료된 것 같습니다. 'authenticate' 도구를 다시 호출해주세요.");
        throw new Error("세션이 만료되었습니다. 'authenticate' 도구를 다시 호출해주세요.");
      }

      throw error;
    }
  }

  /**
   * MCP 프록시 서버 연결 상태 확인
   *
   * Proxy Server의 health 엔드포인트를 통해 연결 상태와 권한을 확인합니다.
   *
   * @returns 연결 상태, 권한 정보, 블로그 정보
   */
  public async checkConnection(): Promise<{
    connected: boolean;
    blog?: any;
    user?: any;
    canCreatePosts?: boolean;
  }> {
    try {
      // 세션 확인
      if (!this.auth.isAuthenticated()) {
        return { connected: false };
      }

      // Proxy Server를 통해 health 체크
      const data = await this.auth.proxyRequest(
        "POST",
        "/mcp/health",
        {}
      ) as any;

      // Proxy Server와 Backend가 모두 정상인 경우
      return {
        connected: true,
        blog: this.auth.blogInfo,
        user: { id: this.auth.userId },
        canCreatePosts: data.can_create_posts || false,
      };
    } catch (error) {
      console.error("MCP 프록시 연결 확인 실패:", error);
      return { connected: false };
    }
  }
}