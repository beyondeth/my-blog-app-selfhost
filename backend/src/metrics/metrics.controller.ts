
/**
 * Prometheus 메트릭 컨트롤러
 * @description Prometheus가 스크래핑하는 공개 메트릭 엔드포인트
 * Docker 내부 네트워크에서만 접근 가능
 */

import {
  Controller,
  Get,
  Req,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { register } from 'prom-client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('metrics')
export class MetricsController {
  /**
   * Prometheus 메트릭 엔드포인트
   * @description Docker 내부 네트워크에서만 접근 가능
   * @returns Prometheus 형식의 메트릭 텍스트
   */
  @Public()
  @Get()
  async getMetrics(@Req() req: Request): Promise<string> {
    const clientIP = req.ip || req.connection.remoteAddress || '';

    // 디버깅을 위한 로깅
    console.log(`[MetricsController] Incoming request from IP: ${clientIP}`);

    // Docker 내부 네트워크 IP 패턴 (RFC 1918 private IP ranges)
    const isDockerNetwork =
      clientIP.startsWith('172.') ||              // Docker bridge networks (172.16.0.0/12)
      clientIP.startsWith('::ffff:172.') ||       // IPv6 mapped Docker IP
      clientIP.startsWith('192.168.') ||          // Docker Desktop host IP (192.168.0.0/16)
      clientIP.startsWith('::ffff:192.168.') ||   // IPv6 mapped
      clientIP.startsWith('10.') ||               // Private network (10.0.0.0/8)
      clientIP.startsWith('::ffff:10.') ||        // IPv6 mapped
      clientIP === '127.0.0.1' ||                 // localhost
      clientIP === '::1' ||                       // localhost IPv6
      clientIP === '::ffff:127.0.0.1';            // localhost IPv6 mapped

    if (!isDockerNetwork) {
      console.log(`[MetricsController] Access denied for IP: ${clientIP}`);
      throw new ForbiddenException(
        `Access denied: Metrics endpoint is only accessible from Docker internal network (IP: ${clientIP})`
      );
    }

    console.log(`[MetricsController] Access granted for IP: ${clientIP}`);
    return register.metrics();
  }
}
