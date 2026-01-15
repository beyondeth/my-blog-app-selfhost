import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../cache/cache.service';
import { IpSecurityService } from '../services/ip-security.service';

@Injectable()
export class IpBlockMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlockMiddleware.name);
  private readonly REDIS_BLOCK_KEY = 'ip:blocked_list';

  constructor(
    private readonly cacheService: CacheService,
    private readonly ipSecurityService: IpSecurityService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. IP 추출 (Cloudflare/Proxy 헤더 우선)
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      
      if (ip) {
        // 실제 IP는 콤마로 구분될 수 있음 (client, proxy1, proxy2...)
        const clientIp = ip.split(',')[0].trim();
        
        // 2. IP 해싱
        const ipHash = this.ipSecurityService.hash(clientIp);
        
        if (ipHash) {
          // 3. Redis 블랙리스트 조회 (O(1))
          const isBlocked = await this.cacheService.isSetMember(this.REDIS_BLOCK_KEY, ipHash);
          
          if (isBlocked) {
            this.logger.warn(`🚫 Blocked IP access attempt: ${this.ipSecurityService.mask(clientIp)}`);
            // 403 Forbidden 반환
            return res.status(403).json({
              statusCode: 403,
              message: 'Access denied due to IP restrictions.',
              error: 'Forbidden'
            });
          }
        }
      }
      
      next();
    } catch (error) {
      // 에러 발생 시 통과 (서비스 가용성 우선)
      this.logger.error(`Error in IP Block Middleware: ${error.message}`);
      next();
    }
  }
}
