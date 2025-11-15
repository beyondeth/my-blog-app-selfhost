import { Injectable, Logger } from '@nestjs/common';

interface CloudflarePurgeResponse {
  success: boolean;
  errors: Array<{
    code: number;
    message: string;
  }>;
  result: {
    id: string;
  };
}

/**
 * Cloudflare 캐시 관리 서비스
 *
 * @description
 * Editor's Pick 등 실시간 업데이트가 필요한 콘텐츠의 캐시를 즉시 제거
 */
@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly zoneId: string;
  private readonly apiToken: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;

    // 환경변수가 없으면 비활성화 (에러 방지)
    this.isEnabled = !!(this.zoneId && this.apiToken);

    if (!this.isEnabled) {
      this.logger.warn('Cloudflare credentials not configured. Cache purge will be disabled.');
    }
  }

  /**
   * 특정 URL 패턴의 캐시 제거
   *
   * @param urls 제거할 URL 목록 (와일드카드 지원)
   * @returns 성공 여부
   */
  async purgeByUrl(urls: string[]): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.debug('Cloudflare purge skipped (not configured)');
      return true; // 실패가 아니라 skip으로 처리
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: urls,
          }),
        }
      );

      const data: CloudflarePurgeResponse = await response.json();

      if (data.success) {
        this.logger.log(`✅ Successfully purged ${urls.length} URLs from Cloudflare cache`);
        return true;
      } else {
        this.logger.error(`❌ Failed to purge Cloudflare cache:`, data.errors);
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error purging Cloudflare cache:', error);
      return false;
    }
  }

  /**
   * Editor's Pick 관련 캐시 즉시 제거
   *
   * @returns 성공 여부
   */
  async purgeEditorPicksCache(): Promise<boolean> {
    const baseUrl = process.env.FRONTEND_URL || 'https://your-domain.com';
    const urls = [
      // Editor's Pick API (모든 limit 파라미터)
      `${baseUrl}/api/v1/posts/editor-picks*`,
      // 홈페이지 (Editor's Pick 섹션이 있는)
      `${baseUrl}/`,
    ];

    this.logger.debug(`🗑️ Purging Editor's Pick cache...`);
    return await this.purgeByUrl(urls);
  }

  /**
   * 전체 캐시 제거 (관리자용)
   *
   * @returns 성공 여부
   */
  async purgeAll(): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.debug('Cloudflare purge all skipped (not configured)');
      return true;
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            purge_everything: true,
          }),
        }
      );

      const data: CloudflarePurgeResponse = await response.json();

      if (data.success) {
        this.logger.log(`✅ Successfully purged all Cloudflare cache`);
        return true;
      } else {
        this.logger.error(`❌ Failed to purge all Cloudflare cache:`, data.errors);
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error purging all Cloudflare cache:', error);
      return false;
    }
  }
}