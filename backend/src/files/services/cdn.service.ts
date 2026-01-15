import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { File } from "../entities/file.entity";

export interface CDNUrl {
  url: string;
  cached: boolean;
  expiresAt?: Date;
  headers?: Record<string, string>;
}

/**
 * CDN 서비스
 * Cloudflare CDN 연동
 */
@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private readonly cdnEnabled: boolean;
  private readonly cdnDomain: string;
  private readonly cloudflareZoneId: string;
  private readonly cloudflareApiToken: string;

  // LRU 캐시 for CDN URLs (메모리에 1000개까지 캐시)
  private urlCache = new Map<string, string>();
  private readonly maxCacheSize = 1000;

  constructor(private configService: ConfigService) {
    // 환경변수 직접 읽기 (S3Service와 동일한 패턴)
    const cdnEnabledRaw = this.configService.get("CDN_ENABLED", "false");
    this.cdnEnabled = cdnEnabledRaw === "true";
    this.cdnDomain = this.configService.get("CDN_DOMAIN", "");
    this.cloudflareZoneId = this.configService.get("CLOUDFLARE_ZONE_ID", "");
    this.cloudflareApiToken = this.configService.get(
      "CLOUDFLARE_API_TOKEN",
      "",
    );

    // 디버깅 로그
    this.logger.debug(
      `CDN_ENABLED raw value: "${cdnEnabledRaw}" (type: ${typeof cdnEnabledRaw})`,
    );
    this.logger.debug(`CDN_ENABLED parsed: ${this.cdnEnabled}`);
    this.logger.debug(`CDN_DOMAIN: "${this.cdnDomain}"`);

    if (this.cdnEnabled) {
      this.logger.log(
        `✅ Cloudflare CDN enabled with domain: ${this.cdnDomain}`,
      );
      if (!this.cloudflareZoneId || !this.cloudflareApiToken) {
        this.logger.warn(
          "⚠️ Cloudflare credentials not configured - cache purge will not work",
        );
      }
    } else {
      this.logger.log("❌ CDN disabled - using S3 direct URLs");
    }
  }

  /**
   * CDN URL 생성
   */
  generateCdnUrl(
    file: File,
    options?: {
      transform?: boolean;
      width?: number;
      height?: number;
      format?: "webp" | "jpeg" | "png";
      quality?: number;
    },
  ): CDNUrl {
    if (!this.cdnEnabled) {
      // CDN 비활성화 시 S3 직접 URL 반환
      return {
        url: this.generateS3Url(file.fileKey),
        cached: false,
      };
    }

    // 선행 슬래시 제거 (중복 슬래시 방지)
    let cdnPath = file.fileKey.startsWith("/")
      ? file.fileKey.substring(1)
      : file.fileKey;

    // Cloudflare Image Resizing 파라미터 추가
    // https://developers.cloudflare.com/images/image-resizing/
    if (options?.transform && this.isImage(file.mimeType)) {
      const params = this.buildTransformParams(options);
      cdnPath = `${cdnPath}?${params}`;
    }

    const baseUrl = `https://${this.cdnDomain}/${cdnPath}`;

    return {
      url: baseUrl,
      cached: true,
      headers: this.getCacheHeaders(file.fileType),
    };
  }

  /**
   * S3 키만으로 CDN URL 생성 (File 엔티티 없이)
   * UsersService 등에서 프로필 이미지 URL 생성 시 사용
   * LRU 캐시 적용으로 중복 생성 방지
   */
  generateCdnUrlFromKey(
    s3Key: string,
    mimeType: string = "image/jpeg",
  ): string {
    // 캐시 키 생성 (s3Key + mimeType로 고유 키)
    const cacheKey = `${s3Key}:${mimeType}`;

    // 캐시에 있으면 반환
    if (this.urlCache.has(cacheKey)) {
      return this.urlCache.get(cacheKey)!;
    }

    // CDN URL 생성
    let url: string;
    if (!this.cdnEnabled) {
      // CDN 비활성화 시 S3 직접 URL 반환
      url = this.generateS3Url(s3Key);
    } else {
      // 선행 슬래시 제거 (중복 슬래시 방지)
      const cleanKey = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
      url = `https://${this.cdnDomain}/${cleanKey}`;
    }

    // LRU 캐시 관리
    if (this.urlCache.size >= this.maxCacheSize) {
      // 가장 오래된 항목 삭제 (Map의 순서 보장)
      const firstKey = this.urlCache.keys().next().value;
      this.urlCache.delete(firstKey);
    }

    // 캐시에 저장
    this.urlCache.set(cacheKey, url);

    // 디버그 로그 (1% 확률로만 남기지 않으면 로그가 너무 많아짐)
    if (Math.random() < 0.01) {
      this.logger.debug(
        `CDN URL cache size: ${this.urlCache.size}/${this.maxCacheSize}`,
      );
    }

    return url;
  }

  /**
   * 썸네일 URL 생성
   */
  generateThumbnailUrl(file: File, size: "small" | "medium" | "large"): CDNUrl {
    if (!this.isImage(file.mimeType)) {
      throw new Error("File is not an image");
    }

    const dimensions = this.getThumbnailDimensions(size);

    return this.generateCdnUrl(file, {
      transform: true,
      width: dimensions.width,
      height: dimensions.height,
      format: "webp",
      quality: 70,
    });
  }

  /**
   * 다중 해상도 URL 세트 생성 (srcset용)
   */
  generateResponsiveUrls(file: File): Array<{
    url: string;
    width: number;
    descriptor: string;
  }> {
    if (!this.isImage(file.mimeType)) {
      return [];
    }

    const sizes = [320, 640, 960, 1280, 1920];
    const urls = [];

    for (const width of sizes) {
      const cdnUrl = this.generateCdnUrl(file, {
        transform: true,
        width,
        format: "webp",
        quality: 85,
      });

      urls.push({
        url: cdnUrl.url,
        width,
        descriptor: `${width}w`,
      });
    }

    return urls;
  }

  /**
   * Cloudflare 캐시 무효화 (Purge API)
   * 무료 티어: 1,000회/일 제한
   * https://developers.cloudflare.com/api/operations/zone-purge
   */
  async invalidateCache(paths: string[]): Promise<void> {
    if (!this.cdnEnabled) {
      this.logger.debug("CDN disabled - skipping cache invalidation");
      return;
    }

    if (!this.cloudflareZoneId || !this.cloudflareApiToken) {
      this.logger.warn(
        "Cloudflare credentials not configured - skipping cache invalidation",
      );
      return;
    }

    if (paths.length === 0) {
      this.logger.debug("No paths to invalidate");
      return;
    }

    try {
      // Cloudflare API는 한 번에 최대 30개 URL 지원
      // 무료 티어: 1,000회/일 제한이 있으므로 신중하게 사용
      const batchSize = 30;
      const totalBatches = Math.ceil(paths.length / batchSize);

      this.logger.log(
        `🔄 Purging Cloudflare cache for ${paths.length} paths (${totalBatches} batches)`,
      );

      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        await this.purgeCloudflareCache(batch);

        // API Rate Limiting 방지: 배치 간 100ms 대기
        if (i + batchSize < paths.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      this.logger.log(`✅ Cloudflare cache purged successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to purge Cloudflare cache:`, error.message);
      // 캐시 무효화 실패해도 서비스는 계속 동작 (Cache Busting으로 대체)
    }
  }

  /**
   * 파일 삭제 시 CDN 캐시 제거
   */
  async handleFileDeletion(file: File): Promise<void> {
    const paths = [file.fileKey];

    // 썸네일이 있다면 함께 무효화
    if (file.metadata?.thumbnails) {
      paths.push(...file.metadata.thumbnails);
    }

    await this.invalidateCache(paths);
  }

  /**
   * Private: Cloudflare Purge API 호출
   */
  private async purgeCloudflareCache(filePaths: string[]): Promise<void> {
    // 파일 경로를 완전한 URL로 변환
    const urls = filePaths.map((path) => {
      // path가 이미 http로 시작하면 그대로 사용
      if (path.startsWith("http")) {
        return path;
      }
      // 아니면 CDN 도메인과 결합
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `https://${this.cdnDomain}${cleanPath}`;
    });

    const apiUrl = `https://api.cloudflare.com/client/v4/zones/${this.cloudflareZoneId}/purge_cache`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: urls,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Cloudflare API error: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        `Cloudflare purge failed: ${JSON.stringify(data.errors)}`,
      );
    }

    this.logger.debug(`Purged ${urls.length} URLs from Cloudflare cache`);
  }

  /**
   * Private: Object Storage 직접 URL 생성 (AWS S3 또는 OCI)
   */
  private generateS3Url(key: string): string {
    // Docker 개발 환경 감지
    const isDockerDev =
      process.env.NODE_ENV === "development" &&
      process.env.DOCKERIZED === "true";

    if (isDockerDev) {
      // Docker 환경에서는 내부 네트워크 URL을 통한 파일 프록시 사용
      const backendUrl =
        process.env.INTERNAL_BACKEND_URL || "http://backend:3000";
      return `${backendUrl}/api/v1/files/proxy/${key}`;
    }

    // 환경변수 직접 읽기 (ConfigService 네임스페이스가 없을 경우 대비)
    const bucket =
      this.configService.get("AWS_S3_BUCKET") ||
      this.configService.get("s3.bucket");
    const region =
      this.configService.get("AWS_REGION") ||
      this.configService.get("s3.region");
    const storageProvider = this.configService.get("STORAGE_PROVIDER", "aws");
    const ociNamespace = this.configService.get("OCI_NAMESPACE");

    if (storageProvider === "oci" && ociNamespace) {
      // OCI Object Storage URL 형식 (Path-style)
      return `https://${ociNamespace}.compat.objectstorage.${region}.oraclecloud.com/${bucket}/${key}`;
    } else {
      // AWS S3 URL 형식
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
  }

  /**
   * Private: 이미지 변환 파라미터 생성 (Cloudflare 형식)
   * Cloudflare Image Resizing 파라미터
   */
  private buildTransformParams(options: any): string {
    const params = new URLSearchParams();

    // Cloudflare Image Resizing 파라미터
    // https://developers.cloudflare.com/images/image-resizing/url-format/
    if (options.width) params.append("width", options.width.toString());
    if (options.height) params.append("height", options.height.toString());
    if (options.format) params.append("format", options.format);
    if (options.quality) params.append("quality", options.quality.toString());

    // 기본값: fit=scale-down (원본보다 크게 확대하지 않음)
    if (options.width || options.height) {
      params.append("fit", "scale-down");
    }

    return params.toString();
  }

  /**
   * Private: 캐시 헤더 생성
   * Cloudflare는 s-maxage를 우선 사용 (Edge 캐시 TTL)
   */
  private getCacheHeaders(fileType: string): Record<string, string> {
    const cacheConfig = this.configService.get("cdn.cache");
    let cacheSettings;

    switch (fileType) {
      case "image":
        cacheSettings = cacheConfig?.images || { maxAge: 86400 }; // 기본 24시간
        break;
      case "document":
        cacheSettings = cacheConfig?.documents || { maxAge: 3600 }; // 기본 1시간
        break;
      default:
        cacheSettings = { maxAge: 3600 };
    }

    return {
      "Cache-Control": `public, max-age=${cacheSettings.maxAge}, s-maxage=${cacheSettings.sMaxAge || cacheSettings.maxAge}`,
      Vary: "Accept-Encoding",
    };
  }

  /**
   * Private: 썸네일 크기 조회
   */
  private getThumbnailDimensions(size: string): {
    width: number;
    height: number;
  } {
    const sizes = this.configService.get("cdn.imageTransform.sizes") || {
      small: { width: 320, height: 240 },
      medium: { width: 640, height: 480 },
      large: { width: 1280, height: 960 },
    };
    return sizes[size] || sizes.medium;
  }

  /**
   * Private: 이미지 여부 확인
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{
    enabled: boolean;
    domain?: string;
    provider: string;
    status: "healthy" | "degraded" | "unhealthy";
  }> {
    if (!this.cdnEnabled) {
      return {
        enabled: false,
        provider: "cloudflare",
        status: "healthy",
      };
    }

    try {
      // CDN 엔드포인트 체크
      const testUrl = `https://${this.cdnDomain}/health`;
      const response = await fetch(testUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000), // 5초 타임아웃
      });

      return {
        enabled: true,
        domain: this.cdnDomain,
        provider: "cloudflare",
        status: response.ok ? "healthy" : "degraded",
      };
    } catch (error) {
      this.logger.warn(`CDN health check failed: ${error.message}`);
      return {
        enabled: true,
        domain: this.cdnDomain,
        provider: "cloudflare",
        status: "unhealthy",
      };
    }
  }
}
