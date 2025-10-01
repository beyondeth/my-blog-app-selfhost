import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * MCP 프록시 클라이언트
 *
 * 모든 요청을 MCP Proxy Server로 전달하는 경량 클라이언트
 * 보안 로직은 모두 Proxy Server에서 처리
 * 세션 영속성을 위해 파일 시스템 사용 (GitHub Copilot과 동일한 방식)
 */
export class ProxyClient {
  private proxyUrl: string;
  private sessionId?: string;
  private sessionFile: string;

  constructor() {
    // Proxy Server URL (중앙 서버)
    this.proxyUrl = process.env['PROXY_SERVER_URL'] || 'http://localhost:3002';

    // 세션 파일 경로 (~/.mcp-session)
    // GitHub Copilot과 유사한 방식으로 홈 디렉토리에 저장
    this.sessionFile = path.join(os.homedir(), '.mcp-session');

    // 저장된 세션 파일에서 세션 ID 로드
    this.loadSessionFromFile();
  }

  /**
   * 저장된 세션 파일에서 세션 ID 로드
   * 파일이 없거나 읽기 실패 시 무시 (새 세션 생성 필요)
   */
  private loadSessionFromFile(): void {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const sessionId = fs.readFileSync(this.sessionFile, 'utf8').trim();
        if (sessionId) {
          this.sessionId = sessionId;
          console.error(`📂 저장된 세션 로드: ${sessionId.substring(0, 8)}...`);
        }
      }
    } catch (error) {
      // 세션 파일 읽기 실패는 무시 (새 인증 필요)
      console.error('⚠️ 세션 파일 읽기 실패, 새 인증이 필요합니다');
    }
  }

  /**
   * 세션 ID를 파일에 저장
   * chmod 600으로 소유자만 읽기/쓰기 가능하도록 설정
   */
  private saveSessionToFile(sessionId: string): void {
    try {
      // 세션 ID를 파일에 저장 (소유자만 읽기/쓰기 권한)
      fs.writeFileSync(this.sessionFile, sessionId, {
        mode: 0o600,  // -rw------- (소유자만 읽기/쓰기)
        encoding: 'utf8'
      });
      console.error(`💾 세션 파일 저장: ${sessionId.substring(0, 8)}... → ~/.mcp-session`);
    } catch (error) {
      console.error('❌ 세션 파일 저장 실패:', error);
    }
  }

  /**
   * 세션 파일 삭제
   * 로그아웃이나 세션 만료 시 호출
   */
  private deleteSessionFile(): void {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
        console.error('🗑️ 세션 파일 삭제됨');
      }
    } catch (error) {
      console.error('⚠️ 세션 파일 삭제 실패:', error);
    }
  }

  /**
   * 세션 ID 설정 (HTTP 모드에서 헤더로 전달받음)
   * 설정 시 파일에도 저장, 제거 시 파일도 삭제
   */
  setSessionId(sessionId?: string) {
    this.sessionId = sessionId;

    if (sessionId) {
      // 세션 ID가 있으면 파일에 저장
      this.saveSessionToFile(sessionId);
    } else {
      // 세션 ID가 없으면 파일 삭제
      this.deleteSessionFile();
    }
  }

  /**
   * 세션 ID 가져오기
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * 현재 세션이 유효한지 검증
   * @returns 세션이 유효하면 true, 그렇지 않으면 false
   */
  async isAuthenticated(): Promise<boolean> {
    // 세션 ID가 없으면 인증되지 않음
    if (!this.sessionId) {
      return false;
    }

    try {
      // 헬스 체크를 통해 세션 유효성 검증
      const health = await this.checkHealth();

      // 세션이 유효하고 토큰이 있는지 확인
      if (health.session?.valid && health.session?.hasToken) {
        console.error(`✅ 세션 유효: ${this.sessionId.substring(0, 8)}...`);
        return true;
      } else {
        console.error(`❌ 세션 만료 또는 무효: ${this.sessionId.substring(0, 8)}...`);
        return false;
      }
    } catch (error) {
      console.error('❌ 세션 검증 실패:', error);
      return false;
    }
  }

  /**
   * 인증 요청 - Proxy Server로 전달
   */
  async authenticate(): Promise<any> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/v1/mcp/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionId && { 'X-MCP-Session-ID': this.sessionId }),
        },
        body: JSON.stringify({}),
      });

      const data = await response.json() as any;

      // 새 세션 ID가 있으면 저장 (data.data 안에 실제 데이터가 있음)
      if (data.data?.sessionId) {
        // setSessionId를 통해 메모리와 파일 모두에 저장
        this.setSessionId(data.data.sessionId);
      }

      // 응답 형식 통일을 위해 data.data를 펼쳐서 반환
      if (data.success) {
        return {
          success: data.success,
          message: data.message,
          ...data.data,  // sessionId, authenticated, authorizationUrl 등
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Proxy 인증 요청 실패:', error);
      throw error;
    }
  }

  /**
   * 포스트 생성 요청 - Proxy Server로 전달
   */
  async createPost(title: string, content: string, tags?: string[], qualityScore?: number): Promise<any> {
    if (!this.sessionId) {
      // 더 명확한 에러 메시지
      throw new Error('인증이 필요합니다. 세션 ID가 없습니다.');
    }

    const postData = {
      title: title || '',
      content: content || '',
      tags: tags || [],
      qualityScore,
    };

    const requestBody = JSON.stringify(postData);

    try {
      const response = await fetch(`${this.proxyUrl}/api/v1/mcp/create-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Session-ID': this.sessionId,
        },
        body: requestBody,
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.message || error.error || '포스트 생성 실패');
      }

      return await response.json();
    } catch (error) {
      // content 축약하여 로깅 (본문 내용 대신 길이만 표시)
      const logInfo = {
        title: title || '[no title]',
        contentLength: content ? content.length : 0,
        tags: tags || []
      };
      console.error('❌ Proxy 포스트 생성 실패:', logInfo, error);
      throw error;
    }
  }

  /**
   * 헬스 체크 - Proxy Server 상태 확인
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/v1/mcp/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionId && { 'X-MCP-Session-ID': this.sessionId }),
        },
        body: JSON.stringify({}),
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Proxy 헬스 체크 실패:', error);
      return { status: 'error', message: 'Proxy Server 연결 실패' };
    }
  }

  /**
   * 마크다운 품질 개선 요청 - Proxy Server로 전달
   */
  async enhanceMarkdown(markdown: string, options?: any): Promise<any> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/v1/mcp/enhance-markdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown,
          options,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.message || error.error || '품질 개선 실패');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Proxy 품질 개선 요청 실패:', error);
      throw error;
    }
  }
}