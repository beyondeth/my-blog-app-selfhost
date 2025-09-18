import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from '../entities/file.entity';
import * as crypto from 'crypto';

export interface CDNUrl {
  url: string;
  cached: boolean;
  expiresAt?: Date;
  headers?: Record<string, string>;
}

/**
 * CDN 서비스
 * CloudFront 또는 다른 CDN과 연동
 */
@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private readonly cdnEnabled: boolean;
  private readonly cdnDomain: string;
  private readonly signedUrls: boolean;

  constructor(private configService: ConfigService) {
    const cdnConfig = this.configService.get('cdn');
    this.cdnEnabled = cdnConfig?.enabled || false;
    this.cdnDomain = cdnConfig?.domain || '';
    this.signedUrls = cdnConfig?.security?.signedUrls || false;
    
    if (this.cdnEnabled) {
      this.logger.log(`CDN enabled with domain: ${this.cdnDomain}`);
    }
  }

  /**
   * CDN URL 생성
   */
  generateCdnUrl(file: File, options?: {
    transform?: boolean;
    width?: number;
    height?: number;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
  }): CDNUrl {
    if (!this.cdnEnabled) {
      // CDN 비활성화 시 S3 직접 URL 반환
      return {
        url: this.generateS3Url(file.fileKey),
        cached: false,
      };
    }

    let cdnPath = file.fileKey;
    
    // 이미지 변환 파라미터 추가
    if (options?.transform && this.isImage(file.mimeType)) {
      const params = this.buildTransformParams(options);
      cdnPath = `${cdnPath}?${params}`;
    }

    const baseUrl = `https://${this.cdnDomain}/${cdnPath}`;
    
    // Signed URL 생성
    if (this.signedUrls) {
      return this.generateSignedUrl(baseUrl);
    }

    return {
      url: baseUrl,
      cached: true,
      headers: this.getCacheHeaders(file.fileType),
    };
  }

  /**
   * 썸네일 URL 생성
   */
  generateThumbnailUrl(file: File, size: 'small' | 'medium' | 'large'): CDNUrl {
    if (!this.isImage(file.mimeType)) {
      throw new Error('File is not an image');
    }

    const dimensions = this.getThumbnailDimensions(size);
    
    return this.generateCdnUrl(file, {
      transform: true,
      width: dimensions.width,
      height: dimensions.height,
      format: 'webp',
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
        format: 'webp',
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
   * CDN 캐시 무효화
   */
  async invalidateCache(paths: string[]): Promise<void> {
    if (!this.cdnEnabled) {
      return;
    }

    const distributionId = this.configService.get('cdn.distributionId');
    
    if (!distributionId) {
      this.logger.warn('CDN distribution ID not configured');
      return;
    }

    try {
      // CloudFront Invalidation API 호출
      // TODO: AWS SDK를 사용하여 실제 구현
      this.logger.log(`Invalidating CDN cache for ${paths.length} paths`);
      
      // 배치 처리 (CloudFront는 한 번에 최대 3000개 경로)
      const batchSize = parseInt(process.env.CDN_BATCH_SIZE || '3000');
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        await this.createInvalidation(distributionId, batch);
      }
    } catch (error) {
      this.logger.error('Failed to invalidate CDN cache:', error);
      throw error;
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
   * Private: S3 직접 URL 생성
   */
  private generateS3Url(key: string): string {
    const bucket = this.configService.get('s3.bucket');
    const region = this.configService.get('s3.region');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Private: Signed URL 생성
   */
  private generateSignedUrl(url: string): CDNUrl {
    const expiresIn = 3600; // 1시간
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    // CloudFront Signed URL 생성 로직
    // TODO: 실제 서명 구현
    const signature = this.generateSignature(url, expiresAt);
    
    return {
      url: `${url}?Expires=${expiresAt.getTime()}&Signature=${signature}`,
      cached: true,
      expiresAt,
    };
  }

  /**
   * Private: 서명 생성
   */
  private generateSignature(url: string, expiresAt: Date): string {
    const privateKey = this.configService.get('cdn.security.privateKey');
    const keyPairId = this.configService.get('cdn.security.keyPairId');
    
    if (!privateKey || !keyPairId) {
      throw new Error('CDN signing credentials not configured');
    }
    
    // CloudFront 서명 정책
    const policy = {
      Statement: [{
        Resource: url,
        Condition: {
          DateLessThan: {
            'AWS:EpochTime': Math.floor(expiresAt.getTime() / 1000),
          },
        },
      }],
    };
    
    const policyString = JSON.stringify(policy);
    const policyBase64 = Buffer.from(policyString).toString('base64');
    
    // RSA-SHA1 서명
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(policyBase64);
    const signature = sign.sign(privateKey, 'base64');
    
    return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Private: 변환 파라미터 생성
   */
  private buildTransformParams(options: any): string {
    const params = new URLSearchParams();
    
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.format) params.append('f', options.format);
    if (options.quality) params.append('q', options.quality.toString());
    
    return params.toString();
  }

  /**
   * Private: 캐시 헤더 생성
   */
  private getCacheHeaders(fileType: string): Record<string, string> {
    const cacheConfig = this.configService.get('cdn.cache');
    let cacheSettings;
    
    switch (fileType) {
      case 'image':
        cacheSettings = cacheConfig.images;
        break;
      case 'document':
        cacheSettings = cacheConfig.documents;
        break;
      default:
        cacheSettings = { maxAge: 3600 };
    }
    
    return {
      'Cache-Control': `public, max-age=${cacheSettings.maxAge}, s-maxage=${cacheSettings.sMaxAge || cacheSettings.maxAge}`,
      'Vary': 'Accept-Encoding',
    };
  }

  /**
   * Private: 썸네일 크기 조회
   */
  private getThumbnailDimensions(size: string): { width: number; height: number } {
    const sizes = this.configService.get('cdn.imageTransform.sizes');
    return sizes[size] || sizes.thumbnail;
  }

  /**
   * Private: 이미지 여부 확인
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Private: CloudFront Invalidation 생성
   */
  private async createInvalidation(distributionId: string, paths: string[]): Promise<void> {
    // TODO: AWS SDK CloudFront client 사용
    this.logger.log(`Creating invalidation for distribution ${distributionId}`);
    
    // 예시 코드
    // const cloudfront = new CloudFrontClient({ region: 'us-east-1' });
    // const command = new CreateInvalidationCommand({
    //   DistributionId: distributionId,
    //   InvalidationBatch: {
    //     CallerReference: Date.now().toString(),
    //     Paths: {
    //       Quantity: paths.length,
    //       Items: paths.map(path => `/${path}`),
    //     },
    //   },
    // });
    // await cloudfront.send(command);
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{
    enabled: boolean;
    domain?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    if (!this.cdnEnabled) {
      return { enabled: false, status: 'healthy' };
    }
    
    try {
      // CDN 엔드포인트 체크
      const testUrl = `https://${this.cdnDomain}/health`;
      const response = await fetch(testUrl, { method: 'HEAD' });
      
      return {
        enabled: true,
        domain: this.cdnDomain,
        status: response.ok ? 'healthy' : 'degraded',
      };
    } catch (error) {
      return {
        enabled: true,
        domain: this.cdnDomain,
        status: 'unhealthy',
      };
    }
  }
}